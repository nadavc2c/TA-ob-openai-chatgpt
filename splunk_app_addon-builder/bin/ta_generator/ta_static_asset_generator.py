from builtins import object
import os
import shutil
import base64
import re

from mako.template import Template
from aob.aob_common.metric_collector import metric_util
from aob.aob_common import logger
from tabuilder_utility import common_util
from ta_generator import builder_util


class AssetGenerator(object):
    AOB_DEPRECATED_LIB = ['tab_splunklib', 'tab_splunktalib', 'splunklib']
    AOB_RESOURCE_LIB = [
        'cloudconnectlib', 'decorator.py', 'functools32', 'httplib2', 'jinja2',
        'jsl', 'jsonpath_rw', 'jsonschema', 'mako', 'markupsafe',
        'modinput_wrapper', 'munch', 'ply', 'requests', 'six.py', 'socks.py',
        'sockshandler.py', 'solnlib', 'sortedcontainers', 'splunk_aoblib',
        'splunklib', 'splunktaucclib'
    ]
    AOB_BUILT_IN_LIBS = AOB_DEPRECATED_LIB + AOB_RESOURCE_LIB

    @metric_util.function_run_time(tags=['asset_generator'])
    def __init__(self, resource_dir, dst_dir, lib_resource_dir, app_name=None):
        self._resource_dir = resource_dir
        self._dst_dir = dst_dir
        self._lib_resource_dir = lib_resource_dir
        self._logger = logger.get_generator_logger()
        if not app_name:
            self._app_name = os.path.split(dst_dir)[-1]
        else:
            self._app_name = app_name

    @metric_util.function_run_time(tags=['asset_generator'])
    def remove_dst_folders(self):
        if os.path.isdir(self._dst_dir):
            shutil.rmtree(self._dst_dir)
        elif os.path.isfile(self._dst_dir):
            os.remove(self._dst_dir)

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_folders(self):
        if os.path.exists(self._dst_dir):
            emsg = "Directory {} is not empty".format(self._dst_dir)
            self._logger.error(emsg)
            raise Exception(emsg)
        shutil.copytree(
            self._resource_dir,
            self._dst_dir,
            ignore=shutil.ignore_patterns('*.template'))

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_content(self, meta, is_setup_page_enabled):
        self.generate_addon_builder_conf(meta)
        self.generate_app_conf(meta, is_setup_page_enabled)
        self.generate_app_manifest(meta)
        self.generate_nav_xml(meta, is_setup_page_enabled)
        self._generate_icon(meta)
        self._logger.info('generate app content to %s', self._dst_dir)

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_TA_assets(self, meta, is_setup_page_enabled):
        self.remove_dst_folders()
        self.generate_folders()
        self.generate_content(meta, is_setup_page_enabled)

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_addon_builder_conf(self, meta):
        fname = os.path.join(self._resource_dir, 'default',
                             'addon_builder.conf.template')
        temp = Template(filename=fname)
        tran = temp.render(
            addon_builder_version=meta.get('tab_version', ''),
            addon_builder_build=meta.get('tab_build_no', ''),
            is_edited=meta.get('is_edited', "1"))
        targetfile = os.path.join(self._dst_dir, 'default',
                                  'addon_builder.conf')
        if not os.path.exists(os.path.dirname(targetfile)):
            os.makedirs(os.path.dirname(targetfile))
        with open(targetfile, 'w+') as write_file:
            write_file.write(tran.strip())
            self._logger.debug('generate addon_builder.conf: %s', tran)

    def is_add_on_builder_conf_exist(self):
        targetfile = os.path.join(self._dst_dir, 'default',
                                  'addon_builder.conf')
        return os.path.isfile(targetfile)

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_app_manifest(self, meta):
        author = meta.get("author", None)
        version = meta.get("version", None)
        description = meta.get("description", None)
        app_name = meta.get('appname', None)
        friendly_name = meta.get('friendly_name', None)
        filename = os.path.join(self._resource_dir, "app.manifest.template")
        temp = Template(filename=filename)
        tran = temp.render(
            author=author,
            version=version,
            description=description,
            app_name=app_name,
            friendly_name=friendly_name)
        targetfile = os.path.join(self._dst_dir, "app.manifest")
        with open(targetfile, "w+") as write_file:
            write_file.write(tran.strip())

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_app_conf(self, meta, is_setup_page_enabled=False):
        author = meta.get("author", None)
        version = meta.get("version", None)
        description = meta.get("description", None)
        visible = meta.get('visible', False) or is_setup_page_enabled
        app_name = meta.get('appname', None)
        friendly_name = meta.get('friendly_name', None)
        build = meta.get('build_no', 1)
        filename = os.path.join(self._resource_dir, "local",
                                "app.conf.template")

        temp = Template(filename=filename)
        tran = temp.render(
            author=author,
            version=version,
            description=description,
            visible=visible,
            app_name=app_name,
            friendly_name=friendly_name,
            build_no=build,
            app_namespace=re.sub('[^\w]', '_', app_name))
        targetfile = os.path.join(self._dst_dir, "local", "app.conf")
        with open(targetfile, "w+") as write_file:
            write_file.write(tran.strip())

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_nav_xml(self, meta, is_setup_page_enabled):
        visible = meta.get('visible', False)
        if is_setup_page_enabled:
            # update the theme color in default.xml which is generated by UCC
            # theme color might be changed
            # avoid to generate all the UCC resources. Just change the file directly
            default_xml_file = os.path.join(self._dst_dir, 'default', 'data',
                                            'ui', 'nav', 'default.xml')
            if os.path.isfile(default_xml_file):
                xml_lines = []
                with open(default_xml_file, 'r') as xml_fp:
                    xml_lines = xml_fp.readlines()
                new_color = 'color="{}">'.format(meta.get('theme', '#65A637'))
                new_xml_lines = [
                    re.sub('color="#\w{6,}">', new_color, l.strip()) for l in xml_lines
                ]
                with open(default_xml_file, 'w') as xml_fp:
                    xml_fp.write('\n'.join(new_xml_lines))
                self._logger.debug('Update the theme color in default.xml')
            else:
                self._logger.error('nav xml file %s not found!', default_xml_file)
            # remove the home.xml
            home_xml = os.path.join(self._dst_dir, 'default', 'data', 'ui',
                                      'views', 'home.xml')
            if os.path.isfile(home_xml):
                os.remove(home_xml)
        else:
            if visible:
                # if setup page is disabled, generate the nav xml.
                theme_color = meta.get('theme', '#65A637')
                filename = os.path.join(self._resource_dir, "default", "data",
                                        "ui", "nav", "default.xml.template")
                temp = Template(filename=filename)
                tran = temp.render(theme=theme_color)
                targetfile = os.path.join(self._dst_dir, 'default', 'data', 'ui',
                                          'nav', 'default.xml')
                with open(targetfile, 'w+') as outfile:
                    outfile.write(tran.strip())
                    self._logger.info('generate the nav xml to %s', targetfile)
                appname = meta['appname']
                filename = os.path.join(self._resource_dir, "default", "data",
                                        "ui", "views", "home.xml.template")
                temp = Template(filename=filename)
                tran = temp.render(appname=appname)
                targetfile = os.path.join(self._dst_dir, 'default', 'data', 'ui',
                                          'views', 'home.xml')
                with open(targetfile, 'w+') as outfile:
                    outfile.write(tran.strip())
                    self._logger.info('generate the home xml to %s',
                                      targetfile)

    @metric_util.function_run_time(tags=['asset_generator'])
    def _generate_icon(self, meta):
        icon_dir = os.path.join(self._dst_dir, 'static')
        if not os.path.isdir(icon_dir):
            os.mkdir(icon_dir)
        icon_large = os.path.join(icon_dir, 'appIcon_2x.png')
        icon_small = os.path.join(icon_dir, 'appIcon.png')
        icon_large_alt = os.path.join(icon_dir, 'appIconAlt_2x.png')
        icon_small_alt = os.path.join(icon_dir, 'appIconAlt.png')
        large_uri = meta.get('large_icon', None)
        small_uri = meta.get('small_icon', None)
        if large_uri:
            with open(icon_large, 'wb') as f1, open(icon_large_alt,
                                                    'wb') as f2:
                pic = base64.b64decode(large_uri)
                f1.write(pic)
                f2.write(pic)
                self._logger.info('generate large icon to %s', icon_large)
        if small_uri:
            with open(icon_small, 'wb') as f1, open(icon_small_alt,
                                                    'wb') as f2:
                pic = base64.b64decode(small_uri)
                f1.write(pic)
                f2.write(pic)
                self._logger.info('generate small icon to %s', icon_small)

    @metric_util.function_run_time(tags=['asset_generator'])
    def regenerate_resource_files(self):
        '''
        regenerate the source file, the resource file includes the library and any static files.
        This is used to upgrade the TA project.
        '''
        # remove the splunktalib and splunklib, recopy the python lib files.
        bin_folder = os.path.join(self._dst_dir, 'bin')
        # recopy the lib to bin dir
        res_bin = os.path.join(self._resource_dir, 'bin')
        # bin_folder already exists, have to use customized copy tree
        builder_util.copy_tree(res_bin, bin_folder, '.*\.template$', True)
        self._logger.info("Regenerate libs in bin folder %s.", bin_folder)

    @metric_util.function_run_time(tags=['asset_generator'])
    def cleanup_splunktalib(self):
        bin_folder = os.path.join(self._dst_dir, 'bin')
        lib_folder = os.path.join(bin_folder, 'splunklib')
        if os.path.isdir(lib_folder):
            shutil.rmtree(lib_folder)
        lib_folder = os.path.join(bin_folder, 'splunktalib')
        if os.path.isdir(lib_folder):
            shutil.rmtree(lib_folder)

    def get_python_lib_dir(self):
        lib_dir = common_util.get_python_lib_dir_name(self._app_name)
        return os.path.join(self._dst_dir, 'bin', lib_dir)

    @metric_util.function_run_time(tags=['asset_generator'])
    def remove_python_lib_dir(self):
        target_dir = self.get_python_lib_dir()
        if os.path.isdir(target_dir):
            shutil.rmtree(target_dir)

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_python_libs(self, overwrite=False):
        target_dir = self.get_python_lib_dir()
        if os.path.exists(target_dir):
            for lib in self.AOB_BUILT_IN_LIBS:
                lib_path = os.path.join(target_dir, lib)
                if os.path.isdir(lib_path):
                    if not overwrite:
                        emsg = "Directory {} is not empty".format(lib_path)
                        self._logger.error(emsg)
                        raise Exception(emsg)
                    else:
                        shutil.rmtree(lib_path)
                elif os.path.isfile(lib_path):
                    if not overwrite:
                        emsg = "File {} exists.".format(lib_path)
                        self._logger.error(emsg)
                        raise Exception(emsg)
                    else:
                        os.remove(lib_path)
        builder_util.copy_tree(self._lib_resource_dir, target_dir,
                               '.*\.pyc$|.*\.pyo$', overwrite)

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_python_libs_if_not_exist(self):
        py_lib_dir = self.get_python_lib_dir()
        lib_path = [os.path.join(py_lib_dir, l) for l in self.AOB_RESOURCE_LIB]
        lib_exist = all([os.path.exists(l) for l in lib_path])
        if not lib_exist:
            self.generate_python_libs(overwrite=True)

    @metric_util.function_run_time(tags=['asset_generator'])
    def migrate_python_libs(self, old_python_lib_dir):
        if not os.path.isdir(old_python_lib_dir):
            emsg = "Old python lib directory {} not found.".format(
                old_python_lib_dir)
            self._logger.error(emsg)
            raise Exception(emsg)
        for d in self.AOB_BUILT_IN_LIBS:
            lib = os.path.join(old_python_lib_dir, d)
            if os.path.isdir(lib):
                shutil.rmtree(lib)
            elif os.path.isfile(lib):
                os.remove(lib)
        self.generate_python_libs(overwrite=True)
        dst = self.get_python_lib_dir()
        for d in os.listdir(old_python_lib_dir):
            if d.startswith("."):
                continue
            src = os.path.join(old_python_lib_dir, d)
            dst_f = os.path.join(dst, d)
            if os.path.exists(dst_f):
                shutil.rmtree(dst_f)
            shutil.move(src, dst)
        shutil.rmtree(old_python_lib_dir)

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_import_declare(self):
        lib_dir_name = common_util.get_python_lib_dir_name(self._app_name)
        filename = os.path.join(self._resource_dir, "bin",
                                "python_lib_declare.py.template")
        temp = Template(filename=filename)
        tran = temp.render(
            app_name=self._app_name, python_lib_dir=lib_dir_name)
        output_file = os.path.join(
            self._dst_dir, 'bin',
            common_util.get_python_declare_file_name(self._app_name))
        with open(output_file, 'w') as f:
            f.write(tran.strip())
            self._logger.info('Generate %s successfully.', output_file)

    @metric_util.function_run_time(tags=['asset_generator'])
    def generate_import_declare_if_not_exist(self):
        output_file = os.path.join(
            self._dst_dir, 'bin',
            common_util.get_python_declare_file_name(self._app_name))
        if os.path.isfile(output_file):
            return
        self.generate_import_declare()

    @metric_util.function_run_time(tags=['asset_generator'])
    def cleanup_ta_bin_folder(self):
        '''
        tranverse the bin folder, if there is no modinputs and modalert
        delete the 3rd libs
        :return: return a boolean value, if true, no modinputs and alerts
        '''
        bin_folder = os.path.join(self._dst_dir, 'bin')
        children = os.listdir(bin_folder)
        py_files = [f for f in children if f.endswith('.py')]
        # always clean up the pyc
        pyc_files = [f for f in children if f.endswith('.pyc')]
        for pyc in pyc_files:
            self._delete_path_resource(os.path.join(bin_folder, pyc))
        nonpyc_children = [f for f in children if not f.endswith('.pyc')]

        bin_cleaned = False
        if len(py_files) <= 0 or (
                len(py_files) == 1 and py_files[0].startswith(
                    common_util.get_python_declare_file_name(self._app_name))):
            py_lib_dir_name = common_util.get_python_lib_dir_name(
                self._app_name)
            # should clean up the dir, No valid modinput/alert now
            for c in nonpyc_children:
                c_name = os.path.join(bin_folder, c)
                if c == py_lib_dir_name:
                    self.cleanup_py_lib_dir(c)
                else:
                    self._delete_path_resource(c_name)
            self._logger.info(
                'delete all the built-in libs and files in bin folder:%s',
                bin_folder)
            bin_cleaned = True
        return bin_cleaned

    @metric_util.function_run_time(tags=['asset_generator'])
    def _delete_path_resource(self, path):
        '''
        lib can be a dir or be a file
        '''
        if os.path.isdir(path):
            shutil.rmtree(path)
        elif os.path.isfile(path):
            os.remove(path)
        else:
            self._logger.warning('path %s does not exist. Can not be delete.',
                                 path)

    @metric_util.function_run_time(tags=['asset_generator'])
    def cleanup_py_lib_dir(self, lib_dir=None):
        lib_dir = lib_dir or common_util.get_python_lib_dir_name(
            self._app_name)
        target_dir = os.path.join(self._dst_dir, 'bin', lib_dir)
        for c in os.listdir(target_dir):
            if c in self.AOB_BUILT_IN_LIBS:
                lib_path = os.path.join(target_dir, c)
                self._delete_path_resource(lib_path)
                self._logger.debug('clean up py lib %s', lib_path)
            elif c.endswith('.pyc') or c.endswith('.pyo'):
                file_path = os.path.join(target_dir, c)
                self._delete_path_resource(file_path)
                self._logger.debug('clean up file %s in py lib', file_path)
        if not os.listdir(target_dir):
            os.rmdir(target_dir)
            self._logger.debug('No files in %s, delete it.', target_dir)

    @metric_util.function_run_time(tags=['asset_generator'])
    def upgrade_from_2_0_0_to_2_1_0(self):
        # regenerate python libs. Need to regen solnlib and modinput wrapper
        self.remove_python_lib_dir()
        self.generate_python_libs()

    @metric_util.function_run_time(tags=['asset_generator'])
    def upgrade_from_2_1_0_to_2_1_1(self, meta):
        '''
        check if the cce lib exists, only update the cce lib
        '''
        cce_name = 'cloudconnectlib'
        cce_lib = os.path.join(self.get_python_lib_dir(), cce_name)
        if os.path.isdir(cce_lib):
            self._logger.info('upgrade cce lib.')
            shutil.rmtree(cce_lib)
            shutil.copytree(os.path.join(self._lib_resource_dir, cce_name), cce_lib)
        self.generate_app_manifest(meta)

    @metric_util.function_run_time(tags=['asset_generator'])
    def upgrade_from_2_2_0_to_3_0_0(self):
        # regenerate python libs
        self.remove_python_lib_dir()
        self.generate_python_libs()
