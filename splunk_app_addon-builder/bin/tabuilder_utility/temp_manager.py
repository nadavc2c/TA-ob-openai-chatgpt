from builtins import str
from builtins import object
import os
import time
import shutil
import json
from tabuilder_utility.builder_exception import CommonException
from aob.aob_common import builder_constant

class TempManager(object):
    def __init__(self, uuid=""):
        self.uuid = uuid + "_" if uuid else ""
        self.app_name = builder_constant.ADDON_BUILDER_APP_NAME
        # rotate files > 30 days
        self.time_delta = 30 * 24 * 60 * 60

        self.temp_dir = self.get_temp_dir()
        if not os.path.exists(self.temp_dir):
            os.makedirs(self.temp_dir)

    def get_temp_dir(self):
        temp_dir = os.path.join(os.environ['SPLUNK_HOME'], "etc", "apps",
                                self.app_name, "local", "temp")
        return temp_dir

    def get_temp_file_cont(self, filename, folder="."):
        fpath = self._get_file_path(filename, folder)
        if not os.path.isfile(fpath):
            return None

        try:
            with open(fpath, "r") as f:
                cont = f.read()
            return cont
        except:
            ex = CommonException()
            ex.set_err_code(9004)
            ex.set_option('filepath', fpath)
            raise ex

    def get_full_path(self, filename, folder=".", check_exist=False):
        fpath = self._get_file_path(filename, folder)
        if check_exist and not os.path.isfile(fpath):
            return None

        return fpath

    def file_exists(self, filename):
        filedir = os.path.join(self.get_temp_dir(), filename)
        return os.path.isfile(filedir)

    def create_temp_file(self, filename, filecont="", folder=".", check_exist=False):
        return self._write_temp_file(filename, filecont, folder=folder)

    def delete_temp_file(self, filename, check_exist=False):
        fpath = self._get_file_path(filename)
        if check_exist and not os.path.isfile(fpath):
            return False

        try:
            if os.path.isfile(fpath):
                os.remove(fpath)
            return True
        except:
            ex = CommonException()
            ex.set_err_code(9001)
            ex.set_option('filepath', fpath)
            raise ex

    def create_temp_dir(self, dirname, folder=".", delete_exist=True):

        if delete_exist:
            self.delete_temp_dir(dirname, folder)

        try:
            abs_dir = self._get_file_path(dirname, folder)
            os.makedirs(abs_dir)
        except:
            ex = CommonException()
            ex.set_err_code(9000)
            ex.set_option('filepath', abs_dir)
            raise ex

    def delete_temp_dir(self, dirname, folder="."):
        abs_dir = self._get_file_path(dirname, folder)

        try:
            if os.path.isdir(abs_dir):
                shutil.rmtree(abs_dir)
        except:
            ex = CommonException()
            ex.set_err_code(9001)
            ex.set_option('filepath', abs_dir)
            raise ex

    def append_temp_file(self, filename, filecont, folder="."):
        return self._write_temp_file(filename, filecont, folder=folder, mode="a")

    def copy_to_temp(self, src, temp_filename, folder=".", force=True):
        fpath = self._get_file_path(temp_filename, folder)
        if not force and os.path.isfile(fpath):
            return False
        try:
            directory = os.path.dirname(fpath)
            if not os.path.isdir(directory):
                os.mkdir(directory)
            if force and os.path.isfile(fpath):
                os.remove(fpath)
            shutil.copy(src, fpath)
            return True
        except Exception as e:
            ex = CommonException(e_message=str(e))
            ex.set_err_code(9002)
            ex.set_option('src_file', src)
            ex.set_option("dst_file", fpath)
            raise ex

    def copy_temp_to_dest(self, temp_filename, dest, force=True):
        if not force and os.path.isfile(dest):
            return False

        fpath = self._get_file_path(temp_filename)
        if not os.path.isfile(fpath):
            return False

        if force and os.path.isfile(dest):
            os.remove(dest)

        try:
            shutil.copy(fpath, dest)
            return True
        except Exception as e:
            ex = CommonException(e_message=str(e))
            ex.set_err_code(9002)
            ex.set_option('src_file', fpath)
            ex.set_option("dst_file", dest)
            raise ex

    def _write_temp_file(self,
                         filename,
                         filecont,
                         folder = ".",
                         check_exist=False,
                         mode="w"):
        fpath = self._get_file_path(filename, folder)
        if check_exist and not os.path.isfile(fpath):
            return False
        try:
            directory = os.path.dirname(fpath)
            if not os.path.isdir(directory):
                os.makedirs(directory)

            with open(fpath, mode) as f:
                f.write(filecont)

            return True
        except:
            ex = CommonException()
            ex.set_err_code(9003)
            ex.set_option('filepath', fpath)
            raise ex

    def _get_file_path(self, filename, folder="."):
        filename = self.uuid + filename
        fpath = os.path.join(self.temp_dir, folder, filename)
        return fpath

    def rotate_temp_files(self):
        curr_time = time.time()
        for fpath in os.listdir(self.temp_dir):
            # skip the dir like __events__
            if fpath.startswith("__"):
                continue
            fpath = os.path.join(self.temp_dir, fpath)
            last_modified = os.path.getmtime(fpath)
            if curr_time - last_modified >= self.time_delta:
                try:
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                    elif os.path.isdir(fpath):
                        shutil.rmtree(fpath)
                except:
                    ex = CommonException()
                    ex.set_err_code(9001)
                    ex.set_option('filepath', fpath)
                    raise ex
