
var $ = require("./lib/zepto").window.$;


exports.main = function () {

console.log("$", $);

console.log("2", $("<h1>Hello from PINF-bundled JavaScript Program</h1>"));

	$("<h1>Hello from PINF-bundled JavaScript Program</h1>").appentTo("BODY");

}
