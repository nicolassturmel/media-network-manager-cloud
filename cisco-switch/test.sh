node app.js -i 192.168.1.130 > /dev/null &
node app.js -i 192.168.1.129 > /dev/null & 
node app.js -i 192.168.1.201 > /dev/null &
read -p "Appuyer sur une touche pour continuer ..."
killall node
