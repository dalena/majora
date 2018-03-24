for i in *.wav; do ffmpeg -i "$i" -c:a libvorbis -b:a 64k "${i%.*}.oga"; done
