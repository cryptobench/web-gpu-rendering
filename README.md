# Web GPU Rendering
Drag, drop, render repeate

Browser-based interface to render blender files using GPU providers on Golem Network.

## Stage 1 - Terminal App
- Python (initial version)
```
cd backend
python3 golem_gpu_rendering.py --scene ../cubes.blend --format PNG --start-frame 1 --stop-frame 6 --output-dir ./
```

<p align="center">
	<img src="screenshots/p1_terminal_app_python.png" width="80%"> 
</p>

- JS (code to use in final app)
```
cd backend
node golem_gpu_rendering.mjs --scene ../cubes.blend --format PNG --startFrame 1 --stopFrame 6 --outputDir ./
```

<p align="center">
	<img src="screenshots/p1_terminal_app_js.png" width="80%"> 
</p>


## Draft Client/Server

Client connection is registered by backend on connection (GET /connect) and return a ClientId.  
This connection is used to notify client of events (SSE server side events).  
Parameters are sent with file and ClientId on upload action then backend stores job on DB after reception.  
On the other end, backend polls DB to process jobs sequentially and notify involved clients.  


- Backend (NodeJS)

```
docker run --name mysql -e MYSQL_ROOT_PASSWORD=rootpassword -e MYSQL_USER=user -e MYSQL_PASSWORD=userpassword -e MYSQL_DATABASE=mydb -p 3306:3306 -d mysql  

cd backend  
npm install  
npm start  
```

- Frontend (ReactJS)
  
```
cd frontend  
npm install  
npm start  
```

<p align="center">
	<img src="screenshots/debug_frontend.png" width="80%"> 
</p>