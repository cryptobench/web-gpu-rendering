require("./global.js");

async function render(	memory, storage, threads, workers,	budget,	startPrice,	cpuPrice, envPrice, timeoutGlobal, timeoutUpload, timeoutRender, scene, format,
						frames, outputDir, whitelist, blacklist, verbose) {
	const ggr = await import("./render.mjs");
	return ggr.render(	queue, memory, storage, threads, workers, budget, startPrice, cpuPrice, envPrice, timeoutGlobal, timeoutUpload, timeoutRender, scene, format,
						frames, outputDir, whitelist, blacklist, verbose);
}

function assemble_frames_and_notify(client, scene_filepath, archive_name, output_dir, clientid, jobuuid, jobindex) {
	var cmd = spawn('blender', ['-b', `${scene_filepath}`, '--python', './assemble_frames.py']);
	cmd.on('close', (code) => {
		child_process.execSync(`zip -r ${archive_name} *`, {
		  cwd: output_dir
		});
		if(client)
			utils.send_event_to_client(client, {"event": "JOB_FINISHED", "clientId": clientid, "jobUuid": jobuuid, "jobIndex": jobindex});
	});
}

function do_post_job_actions(jobid, client, scene_filepath, archive_name, output_dir, clientid, jobuuid, jobindex) {
	var endJobDate = utils.get_mysql_date();
	db.update_table_entry_by_id('jobs', 'jobid', jobid, {finishedat: endJobDate, status: 'DONE'})
	.then(function (result) {
		assemble_frames_and_notify(	client, scene_filepath, archive_name, output_dir, clientid, jobuuid, jobindex);
	});
}

function checkJobs() {
	return db.get_job()
	.then(function (cj) {
		if(cj)
		{
			jobid = cj.job.jobid;
			var client = utils.get_client(clients, cj.job.clientid);

			var frames = utils.range(cj.parameters.startframe, cj.parameters.stopframe + 1, cj.parameters.stepframe);
			var job_frames_len = frames.length;

			var sql_job_update = {status: 'RUNNING'};
			if(cj.job.status == 'TODO')
				sql_job_update.startedat = utils.get_mysql_date();
			else
				cj.already_done.forEach((frame_already_done) => frames = frames.filter(frame => frame !== frame_already_done));

			if(frames.length == 0)
				return do_post_job_actions(	jobid, client, `${cj.parameters.outputdir}/${cj.parameters.scene}`, `${cj.job.clientid}_${cj.job.jobuuid}`,
											cj.parameters.outputdir, cj.job.clientid, cj.job.jobuuid, cj.job.jobindex);
			else
				return db.update_table_entry_by_id('jobs', 'jobid', cj.job.jobid, sql_job_update)
				.then(function (result) {
					return render( 	cj.parameters.memory, cj.parameters.storage, cj.parameters.threads, cj.parameters.workers, cj.parameters.budget, cj.parameters.startprice,
									cj.parameters.cpuprice, cj.parameters.envprice,	cj.parameters.timeoutglobal, cj.parameters.timeoutupload, cj.parameters.timeoutrender,
									`${cj.parameters.outputdir}/${cj.parameters.scene}`, cj.parameters.format, frames, cj.parameters.outputdir, JSON.parse(cj.parameters.whitelist),
									JSON.parse(cj.parameters.blacklist), "true")
					.then((data) => {
						return db.get_job_tasks_done(cj.job.jobid)
						.then(function (result) {
							if(result.length == job_frames_len)
								return do_post_job_actions(	jobid, client, `${cj.parameters.outputdir}/${cj.parameters.scene}`, `${cj.job.clientid}_${cj.job.jobuuid}`,
															cj.parameters.outputdir, cj.job.clientid, cj.job.jobuuid, cj.job.jobindex);
							else
								return db.update_table_entry_by_id('jobs', 'jobid', cj.job.jobid, {status: 'RETRY', retrycount: cj.job.retrycount + 1});
						})
					})
					.catch((err) => {
						utils.send_event_to_client(client, {event: 'INTERNAL_ERROR_3', errorMessage: err, jobIndex: cj.job.jobindex});
						db.insert_error(utils.get_mysql_date(), err, '', cj.job.jobid, '');
					});
				})
		}
		else
			return null;
	})
}

module.exports = {checkJobs}