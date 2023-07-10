from builtins import str
import shutil
import os
import re
import tempfile
import tarfile
import traceback
import stat
import json

from solnlib.splunkenv import make_splunkhome_path
from aob.aob_common import global_setting_util, package_util, logger
from aob.aob_common.conf_parser import TABConfigParser
from aob.aob_common.metric_collector import metric_util
from tabuilder_utility.builder_exception import CommonException
from ta_meta_management import meta_manager, meta_util, meta_manager_event, meta_const

_logger = logger.get_builder_util_logger()

g_default_stanzas = {}

@metric_util.function_run_time(tags=['package_util'])
def get_default_stanza(conf_name):
    if conf_name in g_default_stanzas:
        return g_default_stanzas[conf_name]

    conf_file = make_splunkhome_path(['etc', 'system', 'default', conf_name + '.conf'])
    if os.path.isfile(conf_file):
        # parse the conf file to get the default values
        p = TABConfigParser()
        p.read(conf_file)
        default_stanza = {}
        if p.has_section('default'):
            default_stanza.update(p.items('default'))
        outside_stanza_lines = [l.strip() for l in p.fields_outside_stanza]
        for l in outside_stanza_lines:
            kv = l.split('=')
            if len(kv) == 2:
                key = kv[0].strip()
                value = kv[1].strip()
                if key and value:
                    default_stanza[key] = value
        g_default_stanzas[conf_name] = default_stanza
    else:
        g_default_stanzas[conf_name] = None
    _logger.info('Get default [%s] conf props: %s', conf_name, g_default_stanzas[conf_name])
    return g_default_stanzas[conf_name]


def get_dumped_event_file_name():
    return 'aob_events_in_meta.json'

def get_aob_meta_file_name(app):
    return '{}.aob_meta'.format(app)

def set_package_util_logger(new_logger):
    global _logger
    _logger = new_logger

@metric_util.function_run_time(tags=['package_util'])
def get_app_name_from_root_dirname(app_root_dir):
    abs_path = os.path.abspath(app_root_dir)
    return os.path.basename(abs_path)

@metric_util.function_run_time(tags=['package_util'])
def _parse_version_in_app_conf(conf_file_path):
    '''
    :param conf_file_path: the app.conf file full path
    '''
    ver = None
    if os.path.isfile(conf_file_path):
        parser = TABConfigParser()
        parser.read(conf_file_path)
        if parser.has_option('launcher', 'version'):
            ver = parser.get('launcher', 'version')
    else:
        _logger.debug("File %s not found!", conf_file_path)
    return ver

@metric_util.function_run_time(tags=['package_util'])
def get_app_name(app_conf_filename):
    name = None
    if os.path.isfile(app_conf_filename):
        parser = TABConfigParser()
        parser.read(app_conf_filename)
        if parser.has_option('package', 'id'):
            name = parser.get('package', 'id')
    else:
        _logger.debug("File %s not found!", app_conf_filename)
    return name

@metric_util.function_run_time(tags=['package_util'])
def get_app_version(app_root_dir):
    '''
    :param app_root_dir: the root directory full path
    '''
    default_app_conf_file = os.path.sep.join([app_root_dir, "default", "app.conf"])
    local_app_conf_file = os.path.sep.join([app_root_dir, "local", "app.conf"])
    ver = _parse_version_in_app_conf(local_app_conf_file)
    if not ver:
        ver = _parse_version_in_app_conf(default_app_conf_file)
    if not ver:
        _logger.error('Can not find version property in app.conf')
        ver = "unknown"
    return ver


@metric_util.function_run_time(tags=['package_util'])
def get_package_filename(package_basename, app_version, build_no=None):
    app_version = re.sub('\s+', '_', str(app_version).strip().lower())
    ver = app_version + '-' + str(build_no) if build_no is not None else app_version
    return '{}-{}.spl'.format(package_basename, ver)


@metric_util.function_run_time(tags=['package_util'])
def _merge_conf_file(app_root_dir, conf_file_name):
    '''
    :param app_root_dir: the root directory full path
    :param conf_file_name: the conf file short path, like 'app.conf'. It must endswith ".conf"
    '''
    if not conf_file_name.endswith('.conf'):
        _logger.error('%s is not a conf file. Can not merge it.',
                         conf_file_name)
        return
    dft_conf = os.path.join(app_root_dir, "default", conf_file_name)
    usr_conf = os.path.join(app_root_dir, "local", conf_file_name)
    if os.path.isfile(dft_conf):
        if os.path.isfile(usr_conf):
            parser = TABConfigParser()
            parser.read(usr_conf)
            # for the inputs.conf, filter all the input instance stanzas in local conf
            if usr_conf.split(os.path.sep)[-1] == 'inputs.conf':
                to_be_delete_sections = [s for s in parser.sections() if len(s.split("://")) == 2]
                if to_be_delete_sections:
                    _logger.info("Remove stanzas %s in conf %s", to_be_delete_sections, usr_conf)
                for s in to_be_delete_sections:
                    parser.remove_section(s)

            local_dict = parser.item_dict()
            parser.read(dft_conf)
            default_dict = parser.item_dict()
            # overwrite the key values by local dict
            for stanza, key_values in list(local_dict.items()):
                if stanza not in default_dict:
                    parser.add_section(stanza)
                for k, v in list(key_values.items()):
                    parser.set(stanza, k, v)

            with open(dft_conf, "w") as conf_file:
                parser.write(conf_file)

            _logger.info("%s is merged to %s", usr_conf, dft_conf)
        else:
            _logger.debug("No need to merge. User Conf %s not found!",
                             usr_conf)
    else:
        if os.path.isfile(usr_conf):
            p = TABConfigParser()
            p.read(usr_conf)
            if p.sections() or p.fields_outside_stanza:
                shutil.copyfile(usr_conf, dft_conf)
                _logger.info("copy %s to %s, because %s not found.", usr_conf, dft_conf, dft_conf)
            else:
                os.remove(usr_conf)
                _logger.info('remove {} because it is a empty conf file.'.format(usr_conf))
                return
        else:
            _logger.error(
                "Both default conf %s and user conf %s are not found!",
                dft_conf, usr_conf)
            return
    # if it is inputs.conf, set default disabled = 0
    if (conf_file_name.split(os.path.sep)[-1]
        ) == 'inputs.conf' and os.path.isfile(dft_conf):
        parser = TABConfigParser()
        parser.read(dft_conf)
        item_dict = parser.item_dict()
        for section, key_values in list(item_dict.items()):
            splits = section.split("://")
            # it's default section
            if len(splits) == 1:
                parser.set(section, "disabled", 0)

        with open(dft_conf, "w") as fp:
            parser.write(fp)


@metric_util.function_run_time(tags=['package_util'])
def _merge_local_content_to_default_folder(app_root_dir, child_in_local):
    '''
    process the local folder recursively and merge content file to default folder
    if the file is conf, will merge it, else just copy the local file to default
    :param app_root_dir: the root dir of the app layout.
    :param child_in_local: the child element path in local folder. For example,
                    if it is <app>/local/props.conf. The child_in_local is 'props.conf'
    '''
    _logger.debug('begin to process content in local: %s', child_in_local)
    child_full_path = os.path.join(app_root_dir, 'local', child_in_local)
    if os.path.isfile(child_full_path):
        if child_in_local.endswith('.conf'):
            _logger.info('merge conf %s to default folder', child_in_local)
            _merge_conf_file(app_root_dir, child_in_local)
        else:
            # just copy the file to default
            dst_full_path = os.path.join(app_root_dir, 'default',
                                         child_in_local)
            dst_dir_path = os.path.dirname(dst_full_path)
            if not os.path.isdir(dst_dir_path):
                os.makedirs(dst_dir_path)
            _logger.info('copy file %s to default folder', child_in_local)
            shutil.copyfile(child_full_path, dst_full_path)
    elif os.path.isdir(child_full_path):
        for next_level_child in os.listdir(child_full_path):
            _merge_local_content_to_default_folder(
                app_root_dir, os.path.join(child_in_local, next_level_child))


@metric_util.function_run_time(tags=['package_util'])
def merge_local_to_default(app_root_dir):
    if not os.path.isdir(app_root_dir):
        _logger.error("App root dir %s not found!", app_root_dir)
        return
    local_dir = os.path.join(app_root_dir, "local")
    if not os.path.isdir(local_dir):
        _logger.info("Local dir %s not found.", local_dir)
        return  # no need to merge
    dft_dir = os.path.join(app_root_dir, "default")
    if not os.path.isdir(dft_dir):
        os.makedirs(dft_dir)
        _logger.info("Make default conf dir %s", dft_dir)
    local_folder_children = os.listdir(local_dir)
    for child in local_folder_children:
        _merge_local_content_to_default_folder(app_root_dir, child)
    shutil.rmtree(local_dir)
    _logger.info("Remove local dir %s", local_dir)


@metric_util.function_run_time(tags=['package_util'])
def _set_is_configure(app_conf_file, is_configure):
    parser = TABConfigParser()
    parser.read(app_conf_file)
    if 'install' not in parser.sections():
        parser.add_section('install')
    val = 1 if is_configure else 0
    parser.set('install', 'is_configured', val)
    with open(app_conf_file, "w") as f:
        parser.write(f)

@metric_util.function_run_time(tags=['package_util'])
def update_build_number(app_root_dir, build_number):
    if not os.path.isdir(app_root_dir):
        _logger.error("App root dir %s not found!", app_root_dir)
        return
    dft_conf = os.path.join(app_root_dir, "default", "app.conf")
    if os.path.isfile(dft_conf):
        parser = TABConfigParser()
        parser.read(dft_conf)
        if 'install' not in parser.sections():
            parser.add_section('install')
        parser.set('install', 'build', build_number)
        with open(dft_conf, "w") as f:
            parser.write(f)

@metric_util.function_run_time(tags=['package_util'])
def update_is_configure(app_root_dir):
    if not os.path.isdir(app_root_dir):
        _logger.error("App root dir %s not found!", app_root_dir)
        return
    # always set the is_configured to False when packaging,
    # it is required in App Cert
    dft_conf = os.path.join(app_root_dir, "default", "app.conf")
    local_conf = os.path.join(app_root_dir, "local", "app.conf")
    if os.path.isfile(local_conf):
        _set_is_configure(local_conf, False)
    else:
        if os.path.isfile(dft_conf):
            _set_is_configure(dft_conf, False)
        else:
            _logger.error("No app.conf in dir %s", app_root_dir)


@metric_util.function_run_time(tags=['package_util'])
def update_readme_with_executables_without_source_code(readme_path, files_to_add):
    _logger.info(f'Adding files {files_to_add} to {str(readme_path)}')
    if os.path.exists(readme_path):
        with open(readme_path, "a") as readme:
            readme.write("# Binary File Declaration\n")
            for one_file in files_to_add:
                readme.write(f"{one_file}: this file does not require any source code\n")
    else:
        _logger.error(f'{str(readme_path)} not found!')

def remove_forbidden_commands(ta_root_directory, app_name):
    root = os.path.join(ta_root_directory, "bin", app_name.lower().replace("-", "_"), "aob_py3")
    # TODO: make it working with different versions of this file.
    to_change = [os.path.join(root, "pyrsistent-0.17.3.dist-info", "METADATA")]
    for change in to_change:
        if os.path.exists(change):
            with open(change, "r") as file:
                data = file.read()
            data = data.replace("rm -rf", "alias remove=rm && remove -rf")
            with open(change, "w") as file:
                file.write(data)


@metric_util.function_run_time(tags=['package_util'])
def clean_package_dir(app_root_dir, app_name):
    '''
    clean up the workspace and set all the files in bin with execute permission
    '''
    # remove all the hidden files. splunkbase does not allow hidden files
    # remove all the empty dirs
    for root, dirs, files in os.walk(app_root_dir, topdown=False):
        for f in [i for i in files if i.startswith('.')]:
            p = os.path.join(root, f)
            os.remove(p)
            _logger.debug("Remove file %s", p)
        for d in [i for i in dirs if i.startswith('.')]:
            p = os.path.join(root, d)
            shutil.rmtree(p)
            _logger.debug("Remove directory %s", p)
        if len(dirs + files) == 0 or len(os.listdir(root)) == 0:
            # the children of root may be removed. So, we need to list it again
            os.rmdir(root)

    meta_files = [get_dumped_event_file_name(), get_aob_meta_file_name(app_name)]
    for meta_file in meta_files:
        file_path = os.path.join(app_root_dir, meta_file)
        if os.path.isfile(file_path):
            _logger.debug("Clean up the meta file:%s", file_path)
            os.remove(file_path)

    account_conf_file = global_setting_util.get_global_account_conf_file_name(app_name)
    local_confs = set([
        global_setting_util.get_global_settings_conf_file_name(app_name),
        global_setting_util.GLOBAL_PASSWORD_CONF,
        app_name + '_credential.conf', app_name + '.conf',
        app_name + '_customized.conf', 'password.conf', 'passwords.conf'
    ])
    _logger.debug("Local conf list: %s", local_confs)
    files_to_clean = []
    files_set_executable = []
    files_without_source_code = []
    files_with_rw_r_r = []
    for dir_name, subdir_list, files in os.walk(app_root_dir):
        for file_name in files:
            if file_name.endswith("pyc") or file_name.endswith(
                    "pyo") or file_name == "local.meta" or file_name == account_conf_file:
                files_to_clean.append(os.path.join(dir_name, file_name))
            elif os.path.split(dir_name.rstrip(os.path.sep))[
                    -1] == 'local' and file_name in local_confs:
                files_to_clean.append(os.path.join(dir_name, file_name))
            elif 'conf.orig.pre' in file_name:
                # fix weird issue TAB-1506
                files_to_clean.append(os.path.join(dir_name, file_name))
            elif file_name.endswith(".py") or file_name.endswith(".sh"):
                for excluded_dir in ["lib"]:
                    if not dir_name.startswith(os.path.join(app_root_dir, excluded_dir)):
                        files_set_executable.append(os.path.join(dir_name, file_name))
            elif file_name.endswith(".exe") or file_name.endswith(".so"):
                files_without_source_code.append(os.path.join(dir_name, file_name))
            else:
                # It looks like some files when being built on CI/CA they get rw-rw-rw-.
                # This is for now an hack to it.
                files_with_rw_r_r.append(os.path.join(dir_name, file_name))

    for f in files_to_clean:
        _logger.debug("Clean file %s", f)
        os.remove(f)
    for f in files_set_executable:
        os.chmod(f, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)
    for f in files_with_rw_r_r:
        os.chmod(f, stat.S_IREAD | stat.S_IWRITE | stat.S_IRGRP | stat.S_IROTH)
    # rm the temp_certs folder: TAB-2167
    temp_certs = os.path.join(app_root_dir, 'temp_certs')
    if os.path.isdir(temp_certs):
        shutil.rmtree(temp_certs)

    readme_full_path = os.path.join(app_root_dir,"README.txt")
    update_readme_with_executables_without_source_code(readme_full_path, files_without_source_code)
    remove_forbidden_commands(app_root_dir, app_name)

    # clean up the README folder, remove the empty spec files
    README_DIR = os.path.join(app_root_dir, 'README')
    if os.path.isdir(README_DIR):
        for f in os.listdir(README_DIR):
            if f.endswith('.conf.spec'):
                p = TABConfigParser()
                conf = os.path.join(README_DIR, f)
                p.read(conf)
                if p.fields_outside_stanza or p.sections():
                    continue
                # remove the empty file
                _logger.debug('remove the empty conf spec file:' + conf)
                os.remove(conf)


none_set = ['', 'none']
true_set = ['true', '1', 'yes', 'y']
false_set = ['false', '0', 'no', 'n', '']
def is_option_equals(l, r):
    l = str(l).lower().strip()
    r = str(r).lower().strip()
    if l in none_set and r in none_set:
        return True
    if l in true_set and r in true_set:
        return True
    if l in false_set and r in false_set:
        return True
    return l == r


@metric_util.function_run_time(tags=['package_util'])
def rm_default_conf_properties(add_on_project_dir):
    '''
    This is the final chance to clean up the default stanza.
    This is not the perfect way. The perfect way is not saving
    default properties when saving the stanza
    '''
    conf_dir = os.path.join(add_on_project_dir, 'default')
    for conf_file in os.listdir(conf_dir):
        file_path = os.path.join(conf_dir, conf_file)
        if conf_file.endswith('.conf') and os.path.isfile(file_path):
            conf_name = conf_file[:-5]
            default_stanza = get_default_stanza(conf_name)
            if default_stanza:
                to_be_delete = []
                parser = TABConfigParser()
                parser.read(file_path)
                for section in parser.sections():
                    for item in parser.items(section):
                        if is_option_equals(default_stanza.get(item[0]), item[1]):
                            to_be_delete.append((section, item[0]))
                for item in to_be_delete:
                    parser.remove_option(item[0], item[1])
                    _logger.debug('Remove option:%s section:%s in conf:%s', item[1], item[0], conf_name)
                if len(to_be_delete) > 0:
                    with open(file_path, 'w') as fp:
                        parser.write(fp)
                    _logger.debug('Save conf file:%s', file_path)

@metric_util.function_run_time(tags=['package_util'])
def package_add_on(add_on_name, add_on_project_dir, package_file_path, copy_project=True, build_number=None, tabuilder=None):
    '''
    Process the add_on_project content and make it as a packge file
    :param add_on_name: the id of add-on
    :param add_on_project_dir: the directory path for the add_on project content
                            the content should be prepared by workspace_util
    :param package_file_path: the full file path for the package zip file
    '''
    temp_workspace = add_on_project_dir
    if copy_project:
        temp_workspace = os.path.join(tempfile.mkdtemp(), add_on_name)
        shutil.copytree(add_on_project_dir, temp_workspace)
    # begin to process the package in temp workspace
    try:
        # should clean up the unnecessary files before merge
        clean_package_dir(temp_workspace, add_on_name)
        # merge all the conf file
        merge_local_to_default(temp_workspace)
        update_is_configure(temp_workspace)
        rm_default_conf_properties(temp_workspace)
        if tabuilder is not None:
            meta = write_add_on_project_meta(add_on_name, temp_workspace, tabuilder.tab_service)
            if meta_const.SOURCETYPE_BUILDER in meta:
                sourcetypes = list(meta[meta_const.SOURCETYPE_BUILDER].keys())
                if sourcetypes:
                    write_sample_events(add_on_name, sourcetypes, temp_workspace, tabuilder.tab_service)
        if build_number is not None:
            update_build_number(temp_workspace, build_number)
        with tarfile.open(package_file_path, "w:gz") as tar:
            tar.add(temp_workspace, arcname=add_on_name)
    except Exception as e:
        _logger.error('Fail to create add-on package %s', package_file_path)
        _logger.error(traceback.format_exc())
        raise e
    finally:
        if copy_project and os.path.isdir(temp_workspace):
            _logger.debug('clean up the temp workspace %s when packaging add-on.', temp_workspace)
            shutil.rmtree(temp_workspace)


def write_add_on_project_meta(app, workspace, service):
    '''
    write all the addon meta data from KVstore
    '''
    meta = meta_manager.MetaManager.get_app_all_meta(service, app)
    if not meta:
        raise CommonException(
            e_message='fail to get the meta for project ' + app,
            err_code=34,
            options={'app': app})
    meta = meta_util.remove_user_credential_in_meta(meta)
    output_file = os.path.join(
        workspace, package_util.get_aob_meta_file_name(app))
    with open(output_file, 'w') as f:
        json.dump(meta, f)
    _logger.info('dump the app %s meta', app)
    return meta


def write_sample_events(app, sourcetype_list, workspace, service):
    mgr = meta_manager_event.EventMetaManager(None, None, service=service)
    sample_events = mgr.get_events_with_sourcetypes(sourcetype_list)
    events_file = os.path.join(workspace, package_util.get_dumped_event_file_name())
    with open(events_file, 'w') as f:
        json.dump(sample_events, f)
    _logger.info('exporting project:%s, dump all the events in sourcetypes:%s', app, ','.join(sourcetype_list))
