import os
import tempfile

from aob.aob_common import builder_constant


class UccDirUtils:

    @staticmethod
    def get_temp_dir():
        workspace = builder_constant.BUILDER_WORKSPACE_ROOT
        if not os.path.isdir(workspace):
            workspace = None
        return tempfile.mkdtemp(prefix='ta_conf_imp', dir=workspace)

    @staticmethod
    def default_global_config_dir(app_root):
        return os.path.join(app_root, 'appserver', 'static', 'js', 'build')
