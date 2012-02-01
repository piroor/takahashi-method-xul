#!/bin/sh

rm -rf tmp
mkdir tmp
cp -r restartless tmp/
cp -r takahashi/*.* tmp/restartless/content/
cp -r data tmp/restartless/content/

cd tmp/restartless
./make.sh
mv *.xpi ../../
cd ../../

rm -rf tmp

