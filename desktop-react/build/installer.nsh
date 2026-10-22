; ZuzuCord NSIS assisted installer management.
; The same installer detects an existing installation when its install path
; contains the app's uninstall executable. Repair installs over the existing
; application; uninstall invokes the normal interactive Windows uninstaller.
; No account/profile directory is deleted by this installer.
!macro customInit
  IfSilent zuzucord_install_continue
  IfFileExists "$INSTDIR\Uninstall ZuzuCord.exe" 0 zuzucord_install_continue
  MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "ZuzuCord is already installed at:$\r$\n$INSTDIR$\r$\n$\r$\nYES: Repair / reinstall application files$\r$\nNO: Open the ZuzuCord uninstaller$\r$\nCANCEL: Exit setup" IDYES zuzucord_install_continue IDNO zuzucord_uninstall
  Abort
  zuzucord_uninstall:
    ExecWait '"$INSTDIR\Uninstall ZuzuCord.exe"'
    Quit
  zuzucord_install_continue:
!macroend
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "ZuzuCord Setup"
  !define MUI_WELCOMEPAGE_TEXT "Install ZuzuCord for Windows. Repair or uninstall an older version if detected.$\r$\n$\r$\nNewer official versions are downloaded inside ZuzuCord and installed when you close or restart it.$\r$\n$\r$\nLaunch at Windows startup is OFF unless you enable it later in Settings. ZuzuCord installs for your Windows user and does not require permanent administrator access.$\r$\n$\r$\nRepair preserves your ZuzuCord account and personal settings."
  !insertmacro MUI_PAGE_WELCOME
!macroend
