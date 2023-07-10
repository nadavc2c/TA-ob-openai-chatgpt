@ECHO OFF
SETLOCAL
SET toolpath=%~dp0
CALL :GetParentDir "%toolpath:~0,-2%", aobbin
SET aoblib=%aobbin%splunk_app_add_on_builder\
SET PYTHONPATH=%PYTHONPATH%;%aobbin:~0,-1%;%aoblib:~0,-1%
REM echo PYTHONPATH=%PYTHONPATH%
python project_migration_tool.py %*
ENDLOCAL & goto :eof

:GetParentDir
SET %~2=%~dp1
goto :eof
