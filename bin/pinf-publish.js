
const PATH = require("path");
const FS = require("fs-extra");
const SPAWN = require("child_process").spawn;
const WAITFOR = require("waitfor");
const PROGRAM_INSIGHT = require("pinf-it-program-insight");


function main (callback) {

	function findProjectRoot (path, callback) {
		if (FS.existsSync(PATH.join(path, ".git"))) {
			console.log("Using project root:", path);
			return callback(null, path);
		}
		var newPath = PATH.dirname(path);
		if (newPath === path) {
			return callback(new Error("No project root found!"));
		}
		return findProjectRoot(newPath, callback);
	}

	return findProjectRoot(process.cwd(), function (err, rootPath) {
		if (err) return callback(err);

		function runCommands (commands, callback) {
		    var proc = SPAWN("bash", [
		        "-s"
		    ], {
		    	cwd: rootPath
		    });

		    proc.on("error", function(err) {
		    	return callback(err);
		    });
		    var stdout = [];
		    proc.stdout.on('data', function (data) {
		    	stdout.push(data.toString());
				return process.stdout.write(data);
		    });
		    proc.stderr.on('data', function (data) {
				return process.stderr.write(data);
		    });
		    proc.stdin.write(commands.join("\n"));
		    proc.stdin.end();
		    return proc.on('close', function (code) {
		    	if (code) {
		    		return callback(new Error("Commands exited with code: " + code));
		    	}
		        return callback(null, stdout.join(""));
		    });
		}

		return runCommands([
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
			'  exit 1;',
			'fi',
			'git checkout -b gh-pages',
			'git checkout gh-pages',
			'git merge $BRANCH',
		], function (err, stdout) {
			if (err) return callback(err);

			var originalBranch = stdout.match(/Publishing from branch:\s([^\n]+)\n/)[1];

			function publishProgram (programDescriptorPath, callback) {

				return PROGRAM_INSIGHT.parse(programDescriptorPath, {}, function(err, programDescriptor) {
					if (err) return callback(err);

					function traverse (callback) {
						var waitfor = WAITFOR.serial(callback);

						if (
							programDescriptor.combined.config &&
							programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"] &&
							programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"].programs
						) {
							for (var programId in programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"].programs) {
								waitfor(
									PATH.join(PATH.dirname(programDescriptorPath), programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"].programs[programId]),
									publishProgram
								);
							}
						} else {
							console.log("No programs to publish configured at 'config[\"github.com/pinf-to/pinf-to-github-pages/0\"].programs' in '" + programDescriptor.descriptorPaths.join(", ") + "'");
						}

						return waitfor();
					}

					if (
						!programDescriptor.combined.boot ||
						!programDescriptor.combined.boot.package
					) {
						return traverse(callback);
					}

					console.log("Publish program:", programDescriptorPath);

					var templatePath = (
						programDescriptor.combined.config &&
						programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"] &&
						programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"].templates &&
						programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"].templates["index.html"] &&
						PATH.join(PATH.dirname(programDescriptorPath), programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"].templates["index.html"])
					) || PATH.join(__dirname, "../lib/templates/index.html");

					var loaderPath = (
						programDescriptor.combined.config &&
						programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"] &&
						programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"].templates &&
						programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"].templates["loader.js"] &&
						PATH.join(PATH.dirname(programDescriptorPath), programDescriptor.combined.config["github.com/pinf-to/pinf-to-github-pages/0"].templates["loader.js"])
					) || PATH.join(__dirname, "../node_modules/pinf-loader-js/loader.js");


					var toPath = null;
					var indexFile = FS.readFileSync(templatePath, "utf8");
					var relativeBaseUri = PATH.relative(rootPath, PATH.dirname(programDescriptorPath));


					// TODO: Arrive at minimal set of core variables and options to add own.
					indexFile = indexFile.replace(/%boot\.bundle\.uri%/g, (relativeBaseUri?relativeBaseUri+"/":"") + ("bundles/" + programDescriptor.combined.packages[programDescriptor.combined.boot.package].combined.exports.main).replace(/\/\.\//, "/"));
					indexFile = indexFile.replace(/%boot\.loader\.uri%/g, (relativeBaseUri?relativeBaseUri+"/":"") + "bundles/loader.js");
					toPath = PATH.join(rootPath, "index.html");
					console.log("Writing file to:", toPath);
					FS.outputFileSync(toPath, indexFile);

					// TODO: Use loader if mapped in program/package otherwise fall back to default one here.
					toPath = PATH.join(rootPath, (relativeBaseUri?relativeBaseUri+"/":"") + "bundles/loader.js");
					console.log("Writing file to:", toPath);
					FS.copySync(loaderPath, toPath);


					return traverse(callback);
				});
			}

			return publishProgram(PATH.join(rootPath, "program.json"), function (err) {
				if (err) return callback(err);

				// POLICY: Only needed files should be left here.
				// TODO: Remove files that are not needed from branch (i.e. delete and ensure removed from git)

				return runCommands([
					'git add .',
					'git commit -m "[pinf-for-github-pages] Wrote boot files"',
					'git push origin gh-pages',
					'git checkout ' + originalBranch
				], function (err) {
					if (err) return callback(err);

					return callback(null);
				});
			});
		});
	});
}


if (require.main === module) {
	main(function (err) {
		if (err) {
			console.error(err.stack);
		}
	});
}
