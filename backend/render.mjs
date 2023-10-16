import { TaskExecutor, Events } from "@golem-sdk/golem-js";

function range(start, stop, step) {
	var res = [];
	var i = start;
	while (i<stop) {
		res.push(i);
		i += step;
	}
	return res;
}

function eventHandler(event) {
	console.log(event);
}

const myFilter = async (proposal) => {
	var decision = false;

	var cpuprice = proposal.properties['golem.com.pricing.model.linear.coeffs'][0]*3600*1000;
	var envprice = proposal.properties['golem.com.pricing.model.linear.coeffs'][1]*3600*1000;
	var startprice = proposal.properties['golem.com.pricing.model.linear.coeffs'][2]*1000;

	if((cpuprice <= cpu_price) && (envprice <= env_price) && (startprice <= start_price))
		decision = true;

	return decision;
};

var cpu_price = 0;
var env_price = 0;
var start_price = 0;

export async function render(  subnetTag,
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
						startFrame,
						stopFrame,
						stepFrame,
						outputDir,
						verbose
						) {

	cpu_price = cpuPrice;
	env_price = envPrice;
	start_price = startPrice;

	if(format in ["OPEN_EXR_MULTILAYER", "OPEN_EXR"])
        var ext = "exr";
    else
        var ext = format.toLowerCase();

	var myEventTarget = new EventTarget();
	myEventTarget.addEventListener("GolemEvent", (e) => {
		if(verbose == 'true')
			console.log(e.timeStamp, e.name, e.detail);
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
		//logLevel: "debug",
		eventTarget: myEventTarget
	});

	var cmd_display = "PCIID=$(nvidia-xconfig --query-gpu-info | grep 'PCI BusID' | awk -F'PCI BusID : ' '{print $2}') && (nvidia-xconfig --busid=$PCIID --use-display-device=none --virtual=1280x1024 || true) && ((Xorg :1 &) || true) && sleep 5"

	executor.beforeEach(async (ctx) => {
		await ctx
			.beginBatch()
			.uploadFile(scene, "/golem/resources/scene.blend")
			.run(cmd_display)
			.end()
			.catch((e) => console.error(e));
	});

	var frames = range(startFrame, stopFrame + 1, stepFrame);

	const results = executor.map(frames, async (ctx, frame) => {

		var filename = frame.toString().padStart(4, "0");
		var output_file = `${outputDir}/${filename}.${ext}`
    	var cmd_render = `(DISPLAY=:1 blender -b /golem/resources/scene.blend -o /golem/output/ -noaudio -F ${format} -f ${frame.toString()} -- --cycles-device CUDA) || true`

		const result = await ctx
			.beginBatch()
			.run(cmd_render)
			.downloadFile(`/golem/output/${filename}.${ext}`, output_file)
			.end()
			.catch((e) => console.error(e));

		return result?.length ? `${frame}` : "";
	});

	for await (const result of results) {
		//console.log(result);
	}

	await executor.end();
	console.log('executor end');
}
