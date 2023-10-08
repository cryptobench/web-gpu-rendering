import datetime
import subprocess
import json
import asyncio
import argparse
from datetime import timedelta
from multiprocessing import Process, Queue
from decimal import Decimal
from rich import box
from rich.progress import Progress, TextColumn, BarColumn, MofNCompleteColumn
from rich.live import Live
from rich.console import Group
from rich.panel import Panel
from rich.layout import Layout
from rich.console import Console
from rich.table import Table
from rich.align import Align
from yapapi import Golem, Task, WorkContext, events
from yapapi.payload import vm
from yapapi.rest.activity import BatchTimeoutError
from yapapi.strategy import LeastExpensiveLinearPayuMS
from yapapi.contrib.strategy import ProviderFilter
from yapapi.props import com
from yapapi.log import enable_default_logger

messages = []

def check_yagna_account(queue):
    json_account = ""
    cmd = ["yagna", "payment", "status", "--json"]
    try:
        with subprocess.Popen(cmd, stdout = subprocess.PIPE, stderr = subprocess.PIPE, text = True) as proc:
            for line in proc.stderr.read():
                if "Error: Called service `/local/identity/Get` is unavailable" in line:
                    queue.put({'name': 'yagna', 'data': "Yagna is not_running"})
                    return

            for line in proc.stdout.read():
                json_account += line.strip()

            account_amount = float(json.loads(json_account)['amount'])
            account_reserved = float(json.loads(json_account)['reserved'])

            if account_amount - account_reserved < 1:
                if account_reserved > 0:
                    queue.put({'name': 'yagna', 'data': "Yagna daemon has not enought glm available"})
                else:
                    queue.put({'name': 'yagna', 'data': "Yagna daemon has below 1 GLM"})
    except:
        queue.put({'name': 'yagna', 'data': "Yagna is not installed"})

def listen_queue(queue, len_frames):

    console = Console()

    layout = Layout()
    layout.split_column(
        Layout(name="upper"),
        Layout(name="lower")
    )

    prgs1 = Progress(TextColumn("[progress.description]{task.description}"), BarColumn(), MofNCompleteColumn())
    prgs2 = Progress(TextColumn("[progress.description]{task.description}"), BarColumn())

    progress_group = Group(prgs1, prgs2)

    progress_table = Table.grid(expand=True)
    progress_table.add_row(Panel(Align.center(
                            Group(Align.center(progress_group)),
                            vertical="middle",
                        ), title="[b]Providers Status", border_style="bright_blue", padding=(1, 2)))

    layout['lower'].update(progress_table)

    tasks = {}
    with Live(layout, vertical_overflow='visible'):
        tasks['global'] = prgs1.add_task(f"Frames rendered", visible=True, total=len_frames)
        while(1):
            msg = queue.get(block=True)
            if msg['providerid'] is not None and msg['providerid'] not in tasks.keys():
                tasks[msg['providerid']] = prgs2.add_task(f"{msg['providerid']}...{msg['name']}", visible=True, total=None)
            else:
                if msg['name'] == "TaskAccepted":
                    prgs1.update(tasks['global'], advance=1)
                elif msg['name'] == "JobFinished":
                    for providerid, task in tasks.items():
                        if providerid != "global":
                            prgs2.update(task, visible=False)

                message = f"{msg['providerid']}...{msg['name']}"
                if msg['providerid'] is not None:
                    prgs2.update(tasks[msg['providerid']], description=message)

                messages.insert(0, f"{datetime.datetime.now()}...{message}")
                messages_table = Table.grid(expand=True)

                for message in messages:
                    messages_table.add_row(message)

                message_panel = Panel(
                    Align.center(
                        Group(Align.center(messages_table)),
                        vertical="middle",
                    ),
                    box=box.ROUNDED,
                    padding=(1, 2),
                    title="[b]All messages",
                    border_style="bright_blue",
                )

                layout['upper'].update(message_panel)

async def main( queue           = None,
                subnet_tag      = None,
                payment_driver  = None,
                payment_network = None,
                memory          = 0,
                storage         = 0,
                threads         = 0,
                workers         = 0,
                budget          = 0,
                start_price     = 0,
                cpu_price       = 0,
                env_price       = 0 ,
                timeout_global  = 0,
                timeout_upload  = 0,
                timeout_render  = 0,
                scene           = None,
                format          = None,
                frames          = None,
                output_dir      = None):

    if format in ["OPEN_EXR_MULTILAYER", "OPEN_EXR"]:
        ext = "exr"
    else:
        ext = format.lower()

    package = await vm.repo(
        image_hash      = "b5e19a68e0268c0e72309048b5e6a29512e3ecbabd355c6ac590f75d",
        min_mem_gib     = memory,
        min_storage_gib = storage,
        min_cpu_threads = threads,
        capabilities    = ["cuda"],
    )

    def event_consumer(event: events.Event):
        if isinstance(event, events.SubscriptionFailed): queue.put({'name': "SubscriptionFailed", 'providerid': event.provider_id})
        if isinstance(event, events.SubscriptionCreated): queue.put({'name': "SubscriptionCreated", 'providerid': None})
        if isinstance(event, events.CollectFailed): queue.put({'name': "CollectFailed", 'providerid': event.provider_id})
        if isinstance(event, events.ProposalReceived): queue.put({'name': "ProposalReceived", 'providerid': event.provider_id})
        if isinstance(event, events.ProposalRejected): queue.put({'name': "ProposalRejected", 'providerid': event.provider_id})
        if isinstance(event, events.ProposalResponded): queue.put({'name': "ProposalResponded", 'providerid': event.provider_id})
        if isinstance(event, events.ProposalConfirmed): queue.put({'name': "ProposalConfirmed", 'providerid': event.provider_id})
        if isinstance(event, events.ProposalFailed): queue.put({'name': "ProposalFailed", 'providerid': event.provider_id})
        if isinstance(event, events.NoProposalsConfirmed): queue.put({'name': "NoProposalsConfirmed", 'providerid': event.provider_id})
        if isinstance(event, events.JobStarted): queue.put({'name': "JobStarted", 'providerid': None})
        if isinstance(event, events.JobFinished): queue.put({'name': "JobFinished", 'providerid': None})
        if isinstance(event, events.AgreementCreated): queue.put({'name': "AgreementCreated", 'providerid': event.provider_id})
        if isinstance(event, events.AgreementConfirmed): queue.put({'name': "AgreementConfirmed", 'providerid': event.provider_id})
        if isinstance(event, events.AgreementRejected): queue.put({'name': "AgreementRejected", 'providerid': event.provider_id})
        if isinstance(event, events.AgreementTerminated): queue.put({'name': "AgreementTerminated", 'providerid': event.provider_id})
        if isinstance(event, events.ActivityCreateFailed): queue.put({'name': "ActivityCreateFailed", 'providerid': event.provider_id})
        if isinstance(event, events.WorkerStarted): queue.put({'name': "WorkerStarted", 'providerid': event.provider_id})
        if isinstance(event, events.ActivityCreated): queue.put({'name': "ActivityCreated", 'providerid': event.provider_id})
        if isinstance(event, events.TaskStarted): queue.put({'name': "TaskStarted", 'providerid':  event.provider_id})
        if isinstance(event, events.TaskFinished): queue.put({'name': "TaskFinished", 'providerid': event.provider_id})
        if isinstance(event, events.TaskAccepted): queue.put({'name': "TaskAccepted", 'providerid': event.provider_id})
        if isinstance(event, events.TaskRejected): queue.put({'name': "TaskRejected", 'providerid': event.provider_id})
        if isinstance(event, events.ServiceStateChanged): queue.put({'name': "ServiceStateChanged", 'providerid': event.provider_id})
        if isinstance(event, events.ServiceFinished): queue.put({'name': "ServiceFinished", 'providerid': event.provider_id})
        if isinstance(event, events.ScriptSent): queue.put({'name': "ScriptSent", 'providerid':  event.provider_id})
        if isinstance(event, events.CommandStarted): queue.put({'name': "CommandStarted", 'providerid': event.provider_id})
        if isinstance(event, events.CommandStdOut): queue.put({'name': "CommandStdOut", 'providerid': event.provider_id})
        if isinstance(event, events.CommandStdErr): queue.put({'name': "CommandStdErr", 'providerid': event.provider_id})
        if isinstance(event, events.CommandExecuted): queue.put({'name': "CommandExecuted", 'providerid':  event.provider_id})
        if isinstance(event, events.DownloadStarted): queue.put({'name': "DownloadStarted", 'providerid':  event.provider_id})
        if isinstance(event, events.DownloadFinished): queue.put({'name': "DownloadFinished", 'providerid':  event.provider_id})
        if isinstance(event, events.GettingResults): queue.put({'name': "GettingResults", 'providerid':  event.provider_id})
        if isinstance(event, events.ScriptFinished): queue.put({'name': "ScriptFinished", 'providerid':  event.provider_id})
        if isinstance(event, events.WorkerFinished): queue.put({'name': "WorkerFinished", 'providerid':  event.provider_id})
        if isinstance(event, events.InvoiceReceived): queue.put({'name': "InvoiceReceived", 'providerid': event.provider_id})
        if isinstance(event, events.InvoiceAccepted): queue.put({'name': "InvoiceAccepted", 'providerid': event.provider_id})
        if isinstance(event, events.DebitNoteReceived): queue.put({'name': "DebitNoteReceived", 'providerid': event.provider_id})
        if isinstance(event, events.DebitNoteAccepted): queue.put({'name': "DebitNoteAccepted", 'providerid': event.provider_id})
        if isinstance(event, events.PaymentFailed): queue.put({'name': "PaymentFailed", 'providerid': event.provider_id})
        if isinstance(event, events.ExecutionInterrupted): queue.put({'name': "ExecutionInterrupted", 'providerid': event.provider_id})
        if isinstance(event, events.ShutdownFinished): queue.put({'name': "ShutdownFinished", 'providerid': event.provider_id})

    async def worker(ctx: WorkContext, tasks):
        script = ctx.new_script(timeout=timedelta(minutes=(timeout_upload + timeout_render)))
        script.upload_file(scene, "/golem/resources/scene.blend");

        try:
            cmd_display = "PCIID=$(nvidia-xconfig --query-gpu-info | grep 'PCI BusID' | awk -F'PCI BusID : ' '{print $2}') && (nvidia-xconfig --busid=$PCIID --use-display-device=none --virtual=1280x1024 || true) && ((Xorg :1 &) || true) && sleep 5"
            script.run("/bin/sh", "-c", cmd_display)

            async for task in tasks:
                frame = task.data
                cmd_render = "(DISPLAY=:1 blender -b /golem/resources/scene.blend -o /golem/output/ -noaudio -F " + format + " -f " + str(frame) + " -- --cycles-device CUDA) || true"
                script.run("/bin/sh", "-c", cmd_render)
                output_file = f"{output_dir}/{frame:04d}.{ext}"
                future_result = script.download_file(f"/golem/output/{frame:04d}.{ext}", output_file)

                yield script
                result = await future_result

                if result.success:
                    task.accept_result(result=f"{frame:04d}")
                else:
                    task.reject_result(reason="bad result", retry=True)

                script = ctx.new_script(timeout=timedelta(minutes=timeout_render))

        except BatchTimeoutError:
            queue.put('BatchTimeoutError')
            raise

    golem = Golem(
        budget          = budget,
        subnet_tag      = subnet_tag,
        payment_driver  = payment_driver,
        payment_network = payment_network,
    )

    golem.strategy = ProviderFilter(LeastExpensiveLinearPayuMS(
        max_fixed_price = Decimal(str(start_price)),
        max_price_for = {
            com.Counter.CPU: Decimal(str(cpu_price)),
            com.Counter.TIME: Decimal(str(env_price))
        }
    ), lambda provider_id: True)

    async with golem:
        golem.add_event_consumer(event_consumer)

        completed_tasks = golem.execute_tasks(
            worker,
            [Task(data=frame) for frame in frames],
            payload = package,
            max_workers = workers,
            timeout = timedelta(hours = timeout_global)
        )

        async for task in completed_tasks:
            frames.remove(int(task.result))

if __name__ == "__main__":

    queue = Queue()

    check_yagna_account(queue)

    parser = argparse.ArgumentParser()
    parser.add_argument("--subnet-tag",         type = str,                                                             default = "norbert" )
    parser.add_argument("--payment-driver",     type = str,                                                             default = "erc20"   )
    parser.add_argument("--payment-network",    choices = ["mainnet", "goerli", "mumbai", "polygon"],                   default = "goerli"  )
    parser.add_argument("--memory",             type = int,                                                             default = 8         )
    parser.add_argument("--storage",            type = int,                                                             default = 1         )
    parser.add_argument("--threads",            type = int,                                                             default = 4         )
    parser.add_argument("--workers",            type = int,                                                             default = 3         )
    parser.add_argument("--budget",             type = int,                                                             default = 1         )
    parser.add_argument("--start-price",        type = int,                                                             default = 1000      )
    parser.add_argument("--cpu-price",          type = int,                                                             default = 1000      )
    parser.add_argument("--env-price",          type = int,                                                             default = 1000      )
    parser.add_argument("--timeout-global",     type = int,                                                             default = 4         )
    parser.add_argument("--timeout-upload",     type = int,                                                             default = 5         )
    parser.add_argument("--timeout-render",     type = int,                                                             default = 5         )
    parser.add_argument("--scene",              type = str,                                                             required = True     )
    parser.add_argument("--format",             choices = ["PNG", "BMP", "JPEG", "OPEN_EXR", "OPEN_EXR_MULTILAYER"],    required = True     )
    parser.add_argument("--start-frame",        type = int,                                                             required = True     )
    parser.add_argument("--stop-frame",         type = int,                                                             required = True     )
    parser.add_argument("--output-dir",         type = str,                                                             required = True     )
    args = parser.parse_args()

    frames = list(range(args.start_frame, args.stop_frame + 1));

    # TODO: check stop-frame >= start-frame and they exist in scene

    #enable_default_logger(
    #    debug_activity_api  = True,
    #    debug_market_api    = True,
    #    debug_payment_api   = True,
    #    debug_net_api       = True,
    #    log_file            = "golem_gpu_rendering.log",
    #)

    listen_process = Process(target = listen_queue, args = (queue, len(frames)))
    listen_process.start()

    loop = asyncio.get_event_loop()
    task = loop.create_task(main(
        queue           = queue,
        subnet_tag      = args.subnet_tag,
        payment_driver  = args.payment_driver,
        payment_network = args.payment_network,
        memory          = args.memory,
        storage         = args.storage,
        threads         = args.threads,
        workers         = args.workers,
        budget          = args.budget,
        start_price     = args.start_price,
        cpu_price       = args.cpu_price,
        env_price       = args.env_price,
        timeout_global  = args.timeout_global,
        timeout_upload  = args.timeout_upload,
        timeout_render  = args.timeout_render,
        scene           = args.scene,
        format          = args.format,
        frames          = frames,
        output_dir      = args.output_dir))
    loop.run_until_complete(task)

    listen_process.kill()
