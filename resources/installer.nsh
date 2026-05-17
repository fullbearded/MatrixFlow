!macro customHeader
  !system "echo 'MatrixFlow Custom NSIS Header'"
!macroend

!macro customInstall
  CreateShortCut "$DESKTOP\MatrixFlow.lnk" "$INSTDIR\MatrixFlow.exe"
!macroend

!macro customUnInstall
  Delete "$DESKTOP\MatrixFlow.lnk"
!macroend
