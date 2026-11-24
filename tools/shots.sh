#!/bin/zsh
# tools/shots.sh ID "url-with-?capture..." "frames" [extra cap.py args]   -> qa/ID_sheet.jpg (3 columns)
cd "${0:A:h:h}"; python3 tools/cap.py "$1" "$2" "$3" --w 1280 --h 720 --sheet 3 --tile 640 "${@:4}" 2>&1 | grep -v '^$' | cut -c1-1200
