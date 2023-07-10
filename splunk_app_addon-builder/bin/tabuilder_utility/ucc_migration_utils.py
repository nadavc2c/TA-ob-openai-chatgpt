import configparser
import os
import shutil
import tarfile
import traceback

from splunk_add_on_ucc_framework import generate as ucc_gen

from aob.aob_common import logger
from tabuilder_utility import file_content_util
from tabuilder_utility.builder_exception import CommonException
from tabuilder_utility.ucc_dir_utils import UccDirUtils
from tabuilder_utility.ucc_global_config_loader import GlobalConfigLoader

logger = logger.get_builder_util_logger()


class UccMigration:
    UCC_SOURCE_DIR = "ucc_source"
    UCC_OUTPUT_DIR = "ucc_output"

    def __init__(self):
        self.migration_performed = False
        self.work_dir = UccDirUtils.get_temp_dir()

    def import_addon(self, app_package_file):
        UccMigration.extract_tar_file(app_package_file, self.work_dir)
        self.app_name = UccMigration.find_app_name(self.work_dir)
        UccMigration.fix_general_issues(self.work_dir, self.app_name)
        self.full_package_path = os.path.join(self.work_dir, self.app_name)
        self.perform_addon_import()
        return self.work_dir

    @staticmethod
    def fix_general_issues(extracted_dir, app_name):
        UccMigration.fix_ucc_gen_issues(extracted_dir)
        # UccMigration.add_local_dir_if_does_not_exist(os.path.join(extracted_dir, app_name))

    @staticmethod
    def add_local_dir_if_does_not_exist(extracted_dir):
        local_path = os.path.join(extracted_dir, "local")
        if not os.path.exists(local_path):
            os.makedirs(local_path)

    @staticmethod
    def extract_tar_file(app_package_file, extracted_dir):
        temp_dir = extracted_dir
        try:
            with tarfile.open(app_package_file, mode="r:*") as tf:
                if os.path.isdir(temp_dir):
                    shutil.rmtree(temp_dir)
                os.makedirs(temp_dir)
                logger.info(f"Extract project package to {temp_dir}")
                tf.extractall(temp_dir)
        except tarfile.ReadError as err:
            msg = f"Fail to extract TA project file. The file is not a valid tarfile. {str(err)}"
            logger.error(msg + traceback.format_exc())
            raise CommonException(e_message=msg, err_code=76)
        except Exception as e:
            msg = f"Fail to extract TA project. {str(e)}"
            logger.error(msg + traceback.format_exc())
            raise CommonException(e_message=msg, err_code=75)

    @staticmethod
    def find_app_name(extracted_dir):
        for root, dirs, files in os.walk(extracted_dir):
            for filename in files:
                if filename.endswith(".aob_meta"):
                    app_name = filename[0 : filename.find(".aob_meta")]
                    return app_name
        raise CommonException(
            f"The folder {extracted_dir} seems to be invalid, cannot find the app_name",
            75,
        )

    @staticmethod
    def all_build_files(full_path):
        js_path = os.path.join(full_path, "appserver", "static", "js", "build")
        default_files_from_empty_ta = [
            "1.1.js",
            "common.js",
            "configuration_page.js",
            "inputs_page.js",
        ]
        return [os.path.join(js_path, curr) for curr in default_files_from_empty_ta]

    @staticmethod
    def all_js_files(full_path):
        build_path = os.path.join(full_path, "appserver", "static", "js")
        default_files_from_empty_ta = ["setup.js"]
        return [os.path.join(build_path, curr) for curr in default_files_from_empty_ta]

    @staticmethod
    def all_template_files(full_path):
        template_path = os.path.join(full_path, "appserver", "templates")
        default_template_files = ["base.html"]
        return [os.path.join(template_path, curr) for curr in default_template_files]

    # Based on a conversation we had with Harsh Patel and Artem Rys, some files need to be
    # removed before calling ucc-gen, otherwise the old UI will still be used.
    # This set of files is "static", hence they are share among all TAs
    def remove_old_ui_files(self):
        all_files_to_remove = [
            *UccMigration.all_js_files(self.full_package_path),
            *UccMigration.all_build_files(self.full_package_path),
            *UccMigration.all_template_files(self.full_package_path),
        ]
        for to_remove in all_files_to_remove:
            try:
                can_be_removed = os.path.exists(to_remove) and os.path.isfile(to_remove)
                if can_be_removed:
                    os.remove(to_remove)
                logger.info(f"Successfully removed {to_remove}")
            except OSError as error:
                logger.error(f"Cannot remove {to_remove} because of {str(error)}")

    @staticmethod
    def move_all_files(files, source_root_path, local_path, app_name):
        exclude_list = [
            "addon_builder.conf",
            f"{app_name.lower()}_settings.conf",
            f"{app_name.strip().replace('-', '_').lower()}_settings.conf",
        ]
        for current_file in files:
            if current_file not in exclude_list:
                shutil.move(os.path.join(source_root_path, current_file), local_path)

    @staticmethod
    def move_all_dirs(dirs, source_root_path, local_path):
        exclude_list = ["data"]
        for current_dir in dirs:
            if current_dir not in exclude_list:
                shutil.move(os.path.join(source_root_path, current_dir), local_path)

    @staticmethod
    def remove_comments_and_create_backup(input_file_path):
        from json import load, JSONDecodeError

        with open(input_file_path, "r") as input_file_maybe_valid:
            try:
                load(input_file_maybe_valid)
            except JSONDecodeError as ex:
                input_file_maybe_valid.close()
                input_file_backup = input_file_path + ".backup"
                os.rename(input_file_path, input_file_backup)
                with open(input_file_backup, "r") as input_file_invalid, open(
                    input_file_path, "w"
                ) as output_file:
                    for line in input_file_invalid.readlines():
                        if not line.lstrip().startswith("#"):
                            output_file.write(line)

    @staticmethod
    def fix_ucc_gen_issues(extracted_dir):
        for root, dirs, files in os.walk(extracted_dir):
            for filename in files:
                if filename == "app.manifest":
                    UccMigration.remove_comments_and_create_backup(
                        os.path.join(root, filename)
                    )
                    return
        raise CommonException(
            f"Fatal error when processing app.manifest",
            75,
        )

    # There is really no documentation that confirm this, moving everything from default to local dir except for:
    # - data directory
    # - addon_builder.conf
    # - {app_name}_settings.conf
    def move_conf_data_from_default_to_local(self):
        local_path = os.path.join(self.full_package_path, "local")
        if not os.path.exists(local_path):
            try:
                os.makedirs(local_path)
                default_path, dirs, files = next(
                    os.walk(os.path.join(self.full_package_path, "default"))
                )
                UccMigration.move_all_files(
                    files, default_path, local_path, self.app_name
                )
                UccMigration.move_all_dirs(dirs, default_path, local_path)
            except OSError as error:
                error_message = (
                    f"Cannot create the required UCC-GEN missing folders: {str(error)}"
                )
                logger.error(error_message)
                raise CommonException(error_message, 76)

    def prepare_ucc_directories(self, global_loader):
        ucc_gen_source_dir = os.path.join(self.work_dir, UccMigration.UCC_SOURCE_DIR)
        global_config_dir = UccDirUtils.default_global_config_dir(ucc_gen_source_dir)
        os.makedirs(global_config_dir)

        try:
            shutil.copy(global_loader.global_config_path, global_config_dir)
        except OSError as error:
            error_message = f"Cannot copy globalConfig.json the required UCC-GEN missing folders: {str(error)}"
            logger.error(error_message)
            raise CommonException(error_message, 76)
        shutil.copy(
            os.path.join(self.full_package_path, "app.manifest"), ucc_gen_source_dir
        )
        return ucc_gen_source_dir, os.path.join(
            global_config_dir, GlobalConfigLoader.GLOBAL_CONFIG
        )

    # Once you run UCC-GEN, if you run "slim package output/<TA_NAME>" some check is
    # executed. Apparently the *real* TA version is stored into local/app.conf and that
    # is exactly what we should be using when calling UCC-GEN (it also matches the file
    # name version we download from splunkbase)
    def extract_ta_version(self):
        ini = os.path.join(self.full_package_path, "local", "app.conf")
        config = configparser.ConfigParser()
        config.read(ini)
        try:
            return config["launcher"]["version"]
        except KeyError as error:
            error_message = f"Cannot get TA version from {ini}: {str(error)}"
            logger.error(error_message)
            raise CommonException(error_message, 76)

    def call_ucc_gen(self, ucc_gen_source_dir, ucc_gen_global_conf):
        curr_ta_version = self.extract_ta_version()
        ucc_gen_output_dir = os.path.join(self.work_dir, UccMigration.UCC_OUTPUT_DIR)

        logger.info(f"Current TA version is {curr_ta_version}")
        logger.info(f"Global Config {ucc_gen_global_conf}")
        logger.info(f"Output dir {ucc_gen_output_dir}")
        try:
            ucc_gen(
                ucc_gen_source_dir,
                ucc_gen_global_conf,
                curr_ta_version,
                ucc_gen_output_dir,
            )
        except Exception as error:
            error_message = f"Cannot run UCC-GEN: {str(error)}"
            logger.error(error_message)
            raise CommonException(error_message, 76)
        finally:
            shutil.rmtree(ucc_gen_source_dir)
        return ucc_gen_output_dir

    def copy_ucc_gen_data(self, ucc_gen_output_dir):
        try:
            generated_data = os.path.join(ucc_gen_output_dir, self.app_name)
            file_content_util.copy_dir(
                os.path.join(generated_data, "appserver"),
                os.path.join(self.full_package_path, "appserver"),
            )
            shutil.copy(
                os.path.join(generated_data, "default", "restmap.conf"),
                os.path.join(self.full_package_path, "local"),
            )
        finally:
            shutil.rmtree(ucc_gen_output_dir)

    def generate_ucc_ui(self, global_loader):
        ucc_gen_source_dir, ucc_gen_global_conf = self.prepare_ucc_directories(
            global_loader
        )
        ucc_gen_output_dir = self.call_ucc_gen(ucc_gen_source_dir, ucc_gen_global_conf)
        self.copy_ucc_gen_data(ucc_gen_output_dir)

    def perform_addon_import(self):
        global_loader = GlobalConfigLoader(self.full_package_path)
        if global_loader.requires_upgrade():
            self.remove_old_ui_files()
            self.move_conf_data_from_default_to_local()
            self.generate_ucc_ui(global_loader)
            self.migration_performed = True
        else:
            self.move_conf_data_from_default_to_local()
