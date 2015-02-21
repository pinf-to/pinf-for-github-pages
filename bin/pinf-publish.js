
const PUBLISH = require("to.pinf.lib/lib/publish");


PUBLISH.for(module, function (API, callback) {

	var exitOnDirty = true;
	if (process.env.npm_config_argv) {
		if (JSON.parse(process.env.npm_config_argv).original.indexOf("--ignore-dirty") !== -1) {
			exitOnDirty = false;
		}
	}


console.log("ENV", process.env.npm_config_argv);

	return API.runCommands([
    	// @source http://stackoverflow.com/a/2658301
    	'function evil_git_dirty {',
		'  [[ $(git diff --shortstat 2> /dev/null | tail -n1) != "" ]] && echo "*"',
		'}',
		'function parse_git_branch {',
		'  git branch --no-color 2> /dev/null | sed -e \'/^[^*]/d\' -e \'s/* \\(.*\\)/\\1/\'',
		'}',
		'BRANCH=$(parse_git_branch)',
		'echo "Publishing from branch: $BRANCH"',
		// TODO: Prevent this from writing to stdout during if comparison.
		'if evil_git_dirty = "*"; then',
		'  echo "Commit changes to git first!";',
		exitOnDirty ? '  exit 1;' : '',
		'fi',
		'git checkout -b gh-pages',
		'git checkout gh-pages',
		'git merge $BRANCH',
	], function (err, stdout) {
		if (err) return callback(err);

		var originalBranch = stdout.match(/Publishing from branch:\s([^\n]+)\n/)[1];

		return API.getPrograms(function (err, programs) {
			if (err) return callback(err);

			var waitfor = API.WAITFOR.serial(function (err) {
				if (err) return callback(err);

				// POLICY: Only needed files should be left here.
				// TODO: Remove files that are not needed from branch (i.e. delete and ensure removed from git)

				return API.runCommands([
					'git add .',
					'git commit -m "[pinf-for-github-pages] Wrote boot files"',
					'git push -f origin gh-pages',
					'git checkout ' + originalBranch
				], function (err) {
					if (err) return callback(err);

					return callback(null);
				});
			});
			
			for (var programDescriptorPath in programs) {
				waitfor(programDescriptorPath, function (programDescriptorPath, done) {

					programDescriptor = programs[programDescriptorPath];

					console.log("Publish program:", programDescriptorPath);

					var config = API.getConfigFrom(programDescriptor, "github.com/pinf-to/pinf-to-github-pages/0");

					var templatePath = (
						config.templates &&
						config.templates["index.html"] &&
						API.PATH.join(API.PATH.dirname(programDescriptorPath), config.templates["index.html"])
					) || API.PATH.join(__dirname, "../lib/templates/index.html");

					var loaderPath = (
						config.templates &&
						config.templates["loader.js"] &&
						API.PATH.join(API.PATH.dirname(programDescriptorPath), config.templates["loader.js"])
					) || API.PATH.join(__dirname, "../node_modules/pinf-loader-js/loader.js");


					var toPath = null;
					var indexFile = API.FS.readFileSync(templatePath, "utf8");
					var relativeBaseUri = API.PATH.relative(API.getRootPath(), API.PATH.dirname(programDescriptorPath));


					// TODO: Arrive at minimal set of core variables and options to add own.
					indexFile = indexFile.replace(/%boot\.bundle\.uri%/g, (relativeBaseUri?relativeBaseUri+"/":"") + ("bundles/" + programDescriptor.packages[programDescriptor.boot.package].combined.exports.main).replace(/\/\.\//, "/"));
					indexFile = indexFile.replace(/%boot\.loader\.uri%/g, (relativeBaseUri?relativeBaseUri+"/":"") + "bundles/loader.js");
					toPath = API.PATH.join(API.getRootPath(), "index.html");
					console.log("Writing file to:", toPath);
					API.FS.outputFileSync(toPath, indexFile);

					// TODO: Use loader if mapped in program/package otherwise fall back to default one here.
					toPath = API.PATH.join(API.getRootPath(), (relativeBaseUri?relativeBaseUri+"/":"") + "bundles/loader.js");
					console.log("Writing file to:", toPath);
					API.FS.copySync(loaderPath, toPath);

					return done();
				});
			}

			return waitfor();
		});
	});

});
