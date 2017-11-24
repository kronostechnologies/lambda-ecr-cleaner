const AWS = require('aws-sdk');
const ecr = new AWS.ECR();
const semver = require("semver");

exports.handler = (event, context, callback) => {
	start(callback);
};

const start = async (callback) => {
	try {
		console.info('Starting cleanup');
		const repositories = await _listRepositories();
		await _cleanupRepositories(repositories);
		console.info('Cleanup successful');
		callback(null, 'Cleanup successful');
	}
	catch(e) {
		console.error(`Cleanup failed: ${e}`);
		callback(`Cleanup failed: ${e}`);
	}
};

const _cleanupRepositories = async (repositories) => {
	const count = repositories.length;
	let success = 0;
	let skipped = 0;

	let cleaners = [];

	for(let repository of repositories) {
		cleaners.push((async () => {
			try {
				const imageList = await _listImages(repository);
				const oldImages = _filterOldImages(imageList);
				const result = await _deleteImages(repository, oldImages);
				if(result) {
					console.info(`${repository}: Deleted ${oldImages.length} old images`);
					success++;
				}
				else {
					console.info(`${repository}: Nothing to delete`);
					skipped++
				}
			}
			catch(e) {
				console.error(`'${repository} cleanup error: ${e}`);
			}
		})());
	}

	await Promise.all(cleaners);

	console.info(`${success} repositories cleaned up; ${skipped} skipped out of ${count}`);

	const errors = count - skipped - success;
	if(errors) {
		throw `${errors} errors occurred!`;
	}
};

const _listRepositories = () => {
	return new Promise((resolve, reject) => {
		ecr.describeRepositories({}, (err, data) => {
			if(err) {
				reject(err);
			}
			else {
				resolve(data.repositories.map(r => r.repositoryName));
			}
		});
	});
};

const _listImages = (repository) => {
	return new Promise((resolve, reject) => {
		ecr.listImages({
			repositoryName: repository
		}, (err, data) => {
			if(err) {
				reject(err);
			}
			else {
				resolve(data.imageIds);
			}
		});
	});
};

const _filterOldImages = (images) => {
	// All non-version tags
	const pins = images
		.filter(({imageTag: tag}) => tag && !tag.startsWith("version-"))
		.map( ({imageDigest}) => imageDigest);

	// Last 20 versions
	const lastVersions = images
		.filter(({imageTag: tag}) => tag && tag.startsWith("version-"))
		.sort(({imageTag: a}, {imageTag: b}) =>
			semver.compare(a.replace(/^version-/, ''), b.replace(/^version-/, '')))
		.slice(-20)
		.map( ({imageDigest}) => imageDigest);

	// Return all non-matching images
	return images.filter(
		({imageDigest: digest}) =>
			!pins.find(pinDigest => pinDigest === digest) &&
			!lastVersions.find(versionDigest => versionDigest === digest)
	);
};

const _deleteImages = (repository, images) => {
	if(!images.length) {
		return false;
	}

	return new Promise((resolve, reject) => {
		ecr.batchDeleteImage({
			repositoryName: repository,
			imageIds: images
		}, (err, data) => {
			if(err) {
				reject(err);
			}
			else {
				resolve(data);
			}
		});
	});
};