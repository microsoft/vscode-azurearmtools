rem This does not currently work.

npm run build
pushd out
call ..\node_modules\.bin\istanbul cover --root src --dir js-coverage ..\node_modules\mocha\bin\_mocha -- --ui tdd
call ..\node_modules\.bin\remap-istanbul -i js-coverage\coverage.json -t html -o ts-coverage
start ts-coverage\index.html
popd
