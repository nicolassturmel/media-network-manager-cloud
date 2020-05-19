PP=$(pwd)
echo $PP
for i in $(ls)
    do cd $i ; npm i ; cd $PP
done