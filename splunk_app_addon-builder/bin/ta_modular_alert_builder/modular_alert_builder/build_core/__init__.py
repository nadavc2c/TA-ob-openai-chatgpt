from __future__ import absolute_import
import re
import shutil
import os
from ta_modular_alert_builder.modular_alert_builder.build_core.alert_actions_conf_gen import generate_alert_actions_conf, clean_alert_actions_conf
from ta_modular_alert_builder.modular_alert_builder.build_core.alert_actions_html_gen import generate_alert_actions_html_files, clean_alert_actions_html_files
from ta_modular_alert_builder.modular_alert_builder.build_core.alert_actions_py_gen import generate_alert_actions_py_files, clean_alert_actions_py_files
from ta_generator.ta_static_asset_generator import AssetGenerator
from ta_modular_alert_builder.modular_alert_builder.build_core.arf_runner import ARFTestRunner
# import alert_actions_helper as aah
# import traceback


def parse_envs(envs, schema):
    ret = {}
    for k, v in list(envs.items()):
        # "x > y > z" is a recursive string which needs to parse to the deepest
        # levle
        items = re.split(r"\s+>\s+", v)
        root = schema
        for item in items:
            root = root[item]

        ret[k] = root

    return ret

cache_path = {}


def check_file_name(file_name, env):
    # file_name is string, read from setting file
    # this function replaces all ${short_name} and other to its real value
    if file_name in cache_path:
        return cache_path[file_name]

    search = re.findall(r"\${\!?([\w\-\.]+)}", file_name, re.MULTILINE)
    if not search:
        cache_path[file_name] = file_name
        return file_name

    new_str = file_name
    for gp in search:
        if gp in env:
            new_str = new_str.replace("${%s}" % gp, env[gp], re.MULTILINE)
            new_str = new_str.replace("${!%s}" % gp,
                                      re.sub("[^\w]+", "_", env[gp].lower()),
                                      re.MULTILINE)

    # Disable the cache to avoid conflict
    # cache_path[file_name] = new_str
    return new_str


def check_file_list(dirName, file_list, env):
    ret = []
    for dname in file_list:
        new_dname = check_file_name(dname, env)
        if new_dname != dname:
            ret.append((check_file_name(dirName, env), dname, new_dname))

    return ret


def tester(envs, logger, **kwargs):
    dest = envs["test_setting"].get("ta_root_dir")
    build_global_settings(os.path.dirname(dest), logger, envs)
    prepare_libs(dest, logger, envs, force=True)
    run_obj = ARFTestRunner(envs, logger,
                            template_setting=envs.get("template_setting"),
                            **kwargs)
    test_result = run_obj.run()
    run_obj.clean_up()
    return test_result


def build_global_settings(dest, logger, envs):
    """
    global_settings = {
    "server_uri": "",
    "session_key": "",
    "settings" = {
       }
    }
    """
    global_settings = envs.get("global_settings")
    if not global_settings:
        logger.info("No global setting, do nothing")
        return

    logger.info('start to generate global setting')
    output_dir = dest
    logger.info('all_settings="%s"', global_settings)
    #TODO: generate the ucc framework for the modular alert


def prepare_ta_directory_tree(src, dest, logger, envs):
    """
    If dest doesn't exist, then generate a new TA directory tree.
    If dest exists, then merge with the new one
    """
    output_dir = dest

    if not output_dir:
        # if not output, then all content will be print to screen
        logger.info('event="No output_dir", will print content to screen"')
        return output_dir

    if os.path.exists(output_dir):
        logger.info('event="output_dir=%s already exist"',
                    output_dir)
        output_dir = os.path.join(output_dir,
                                  envs["product_id"] + "_temp_output")
        logger.info('event="generate a new output_dir=%s"', output_dir)
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)

    try:
        # copy file
        logger.info('event="Copying directory tree: src=%s dest=%s"',
                    src, output_dir)
        shutil.copytree(src, output_dir)

        # process each file's name
        logger.info('event="Replace each file name\'s placeholder under dir=%s"',
                    output_dir)
        move_list = []
        for dirName, subdirList, fileList in os.walk(output_dir):
            move_list.extend(check_file_list(dirName, subdirList, envs))
            move_list.extend(check_file_list(dirName, fileList, envs))

        for x, y, z in move_list:
            shutil.move(os.path.sep.join([x, y]), os.path.sep.join([x, z]))

    except Exception as e:
        if output_dir != dest and os.path.exists(output_dir):
            logger.info('clean temp_output_dir="%s"', output_dir)
            shutil.rmtree(output_dir)
        raise e
    return output_dir


def is_global_setting_enabled(global_settings):
    if not global_settings:
        return False
    if not global_settings.get("settings"):
        return False

    settings = global_settings.get("settings")
    if len(settings) == 1 and "customized_settings" in list(settings.keys()) and \
            len(settings["customized_settings"]) <= 0:
        return False
    return True


def prepare_libs(dest, logger, envs, force=False):
    global_settings = envs.get("global_settings")
    if not force and is_global_setting_enabled(global_settings):
        logger.info("Do nothing, global setting should have prepared the libs")
        return

    logger.info("Prepare the libs under: %s", dest)
    assert_generator = AssetGenerator(envs.get("resource_dir"),
                                      dest,
                                      envs.get("resource_lib_dir"))
    assert_generator.generate_python_libs_if_not_exist()
    assert_generator.generate_import_declare_if_not_exist()


def move_file_replace_var(src, dest, logger, envs, process_list=None,
                          skip_list=None):
    process_list = process_list or []
    skip_list = skip_list or []
    output_dir = dest
    package_dir = None
    output_content = {}
    conf_return = None
    html_return = None
    py_return = None
    global_settings = envs["global_settings"]

    try:
        if dest:
            output_dir = prepare_ta_directory_tree(src, dest, logger, envs)
            package_dir = os.path.join(dest, envs["product_id"])
            prepare_libs(package_dir, logger, envs)

        build_components = envs["build_components"]
        if build_components["conf"]:
            conf_return = generate_alert_actions_conf(
                input_setting=envs["schema.content"],
                package_path=package_dir,
                logger=logger,
                global_settings=global_settings)

        if build_components["html"]:
            html_return = generate_alert_actions_html_files(
                input_setting=envs["schema.content"],
                package_path=package_dir,
                logger=logger,
                html_setting=envs["html_setting"])

        if build_components["py"]:
            py_return = generate_alert_actions_py_files(
                input_setting=envs["schema.content"],
                package_path=package_dir,
                logger=logger,
                global_settings=global_settings
            )

        if conf_return:
            output_content["conf"] = conf_return
        if html_return:
            output_content["html"] = conf_return
        if py_return:
            output_content["py"] = py_return

        if output_dir != dest:
            """
            Which means the previous output_dir already there
            """
            from . import alert_actions_merge
            alert_actions_merge.merge(
                os.path.join(output_dir, envs["product_id"]),
                os.path.join(dest, envs["product_id"]))
            logger.info('event="merged %s to %s', output_dir, dest)
    finally:
        if output_dir != dest and os.path.exists(output_dir):
            logger.info('clean temp_output_dir="%s"', output_dir)
            shutil.rmtree(output_dir)

    return output_content


def delete_generated_alerts(envs=None, logger=None, **kwargs):
    package_dir = os.path.join(envs["ta_dir"], envs["product_id"])
    clean_alert_actions_conf(
        input_setting=envs["build_setting"],
        package_path=package_dir,
        deleted_alerts=envs.get("deleted_alerts"),
        logger=logger)

    clean_alert_actions_html_files(
        input_setting=envs["build_setting"],
        package_path=package_dir,
        deleted_alerts=envs.get("deleted_alerts"),
        logger=logger)

    clean_alert_actions_py_files(
        input_setting=envs["build_setting"],
        package_path=package_dir,
        logger=logger,
        deleted_alerts=envs.get("deleted_alerts"),
        global_settings=envs.get("global_settings"))
