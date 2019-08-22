tsc app.ts
node app.js -i 192.168.1.130  &
node app.js -i 192.168.1.129  & 
node app.js -i 192.168.1.201  &
read -p "Appuyer sur une touche pour continuer ..."
killall node
