// @pinf-bundle-ignore: 
PINF.bundle("", function(require) {
// @pinf-bundle-module: {"file":"demo.js","mtime":1421297161,"wrapper":"commonjs","format":"commonjs","id":"/demo.js"}
require.memoize("/demo.js", 
function(require, exports, module) {var __dirname = '';


exports.main = function () {


	console.log("DEMO!!");


}

}
, {"filename":"demo.js"});
// @pinf-bundle-module: {"file":null,"mtime":0,"wrapper":"json","format":"json","id":"/package.json"}
require.memoize("/package.json", 
{
    "main": "/demo.js",
    "dirpath": "."
}
, {"filename":"./package.json"});
// @pinf-bundle-ignore: 
});
// @pinf-bundle-report: {}