import os
import shutil

from aob.aob_common import logger


class AssetRepository(object):
    README_NAME = 'README.txt'

    def __init__(self):
        parent_dir = os.path.split(os.path.realpath(__file__))[0]
        self._logger = logger.get_builder_util_logger()
        self._readme_resource_path = os.path.join(parent_dir, 'resources', 'README.txt')

    def copy_readme(self, destination):
        if os.path.isdir(destination):
            shutil.copy(self._readme_resource_path, destination)
        else:
            self._logger.error(f'Cannot copy {self.README_NAME} to {str(destination)}, directory does not exist!')
