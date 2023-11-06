import { TaskExecutor, Events } from "@golem-sdk/golem-js";
import { spawn } from 'node:child_process';
import util from 'util';

const myFilter = async (proposal) => {
	var decision = false;

	var cpuprice = proposal.properties['golem.com.pricing.model.linear.coeffs'][0]*3600*1000;
	var envprice = proposal.properties['golem.com.pricing.model.linear.coeffs'][1]*3600*1000;
	var startprice = proposal.properties['golem.com.pricing.model.linear.coeffs'][2]*1000;

	if((cpuprice <= cpu_price) && (envprice <= env_price) && (startprice <= start_price))
		decision = true;

	return decision;
};

function queue_send(queue, message) {
	if(queue != null)
		queue.send(message);
	else
		console.log(message);
}

function check_yagna_status(queue) {
		var cmd = spawn('yagna', ['payment', 'status', '--json']);
		cmd.stdout.on('data', (data) => {
			var jsondata = JSON.parse(data.toString().replace("\n", ""));
			var account_amount = jsondata.amount;
			var account_reserved = jsondata.reserved;
	        if((account_amount - account_reserved) < 1) {
	            if(account_reserved > 0)
	                queue_send(queue, {event: 'YAGNA_ERROR', error_message: 'Yagna daemon has not enought glm available'});
	            else
	                queue_send(queue, {event: 'YAGNA_ERROR', error_message: 'Yagna daemon has below 1 GLM'});
			}
			else
				queue_send(queue, {event: 'YAGNA_OK'});
		});

		cmd.stderr.on('data', (data) => {
			var sdata = data.toString();
			if(sdata.includes("routing error: Connecting GSB"))
				queue_send(queue, {event: 'YAGNA_ERROR', error_message: 'Yagna is not_running'});
		});

		cmd.on('error', (code) => {
			queue_send(queue, {event: 'YAGNA_ERROR', error_message: 'Yagna is not installed or not in PATH'});
		});
}

var cpu_price = 0;
var env_price = 0;
var start_price = 0;

var deployments_time = {};

export async function render(   queue,
								subnetTag,
								paymentDriver,
								paymentNetwork,
								memory,
								storage,
								threads,
								workers,
								budget,
								startPrice,
								cpuPrice,
								envPrice,
								timeoutGlobal,
								timeoutUpload,
								timeoutRender,
								scene,
								format,
								frames,
								outputDir,
								verbose
								) {

	check_yagna_status(queue);

	cpu_price = cpuPrice;
	env_price = envPrice;
	start_price = startPrice;

	if(format in ["OPEN_EXR_MULTILAYER", "OPEN_EXR"])
        var ext = "exr";
    else
        var ext = format.toLowerCase();

	var myEventTarget = new EventTarget();
	myEventTarget.addEventListener("GolemEvent", (e) => {

		if(e.name == 'AgreementCreated')
			queue_send(queue, {event: 'AGREEMENT_CREATED', agreementId: e.detail.id, providerId: e.detail.providerId, providerName: e.detail.providerName});
		else if(e.name == 'AgreementConfirmed')
		{
			deployments_time[e.detail.id] = Date.now();
			queue_send(queue, {event: 'AGREEMENT_CONFIRMED', agreementId: e.detail.id});
		}
		else if(e.name == 'AgreementRejected')
			queue_send(queue, {event: 'AGREEMENT_REJECTED', agreementId: e.detail.id, providerId: e.detail.providerId, reason: e.detail.reason});
		else if(e.name == 'AgreementTerminated')
			queue_send(queue, {event: 'AGREEMENT_TERMINATED', agreementId: e.detail.id, providerId: e.detail.providerId, reason: e.detail.reason});
		else if(e.name == 'InvoiceReceived')
			queue_send(queue, {event: 'INVOICE_RECEIVED', agreementId: e.detail.agreementId, providerId: e.detail.providerId, amount: e.detail.amount, time: e.detail.timestamp});
	});

	const executor = await TaskExecutor.create({
		subnetTag,
		payment: {paymentDriver, paymentNetwork},
		package: "b5e19a68e0268c0e72309048b5e6a29512e3ecbabd355c6ac590f75d",
		proposalFilter: myFilter,
		minMemGib : memory,
		minStorageGib: storage,
		minCpuThreads: threads,	// minCpuCores
		capabilities: ["cuda"],
		logLevel: "debug",
		eventTarget: myEventTarget
	});

	var cmd_display = "PCIID=$(nvidia-xconfig --query-gpu-info | grep 'PCI BusID' | awk -F'PCI BusID : ' '{print $2}') && (nvidia-xconfig --busid=$PCIID --use-display-device=none --virtual=1280x1024 || true) && ((Xorg :1 &) || true) && sleep 5"

	executor.beforeEach(async (ctx) => {
		var dt = Date.now() - deployments_time[ctx.activity.agreementId];
		queue_send(queue, {agreementId: ctx.activity.agreementId, event: 'DEPLOYMENT_FINISHED', deployment_time: dt});
		const res = await ctx
			.beginBatch()
			.uploadFile(scene, "/golem/resources/scene.blend")
			.run(cmd_display)
			.end()
			.catch((e) => {
				queue_send(queue, {agreementId: ctx.activity.agreementId, event: 'UPLOAD_ERROR', error_message: e});
			});

		var upload_time = Date.parse(res[1].eventDate) - Date.parse(res[0].eventDate)
		queue_send(queue, {agreementId: ctx.activity.agreementId, event: 'UPLOAD_FINISHED', upload_time: upload_time});
	});

	const results = executor.map(frames, async (ctx, frame) => {
		var filename = frame.toString().padStart(4, "0");
		var output_file = `${outputDir}/${filename}.${ext}`
    	var cmd_render = `(DISPLAY=:1 blender -b /golem/resources/scene.blend -o /golem/output/ -noaudio -F ${format} -f ${frame.toString()} -- --cycles-device CUDA)`

		const result = await ctx
			.beginBatch()
			.run(cmd_render)
			.downloadFile(`/golem/output/${filename}.${ext}`, output_file)
			.end()
			.catch((e) => {
				queue_send(queue, {agreementId: ctx.activity.agreementId, event: 'RENDER_FRAME_ERROR', error_message: e});
			});

		var start_render_time = Date.parse(result[0].eventDate);
		var render_frame_time = Date.parse(result[1].eventDate) - start_render_time;

		return {agreementId: ctx.activity.agreementId, event: 'RENDER_FRAME_FINISHED', frame: frame, startRenderTime: start_render_time, renderFrameTime: render_frame_time, outputFile: output_file};
	});

	for await (const result of results) {
		queue_send(queue, result);
	}

	await executor.end();
}
