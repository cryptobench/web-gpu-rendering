import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Button from 'react-bootstrap/Button';
import useScreenSize from 'use-screen-size';
import $ from 'jquery';
import React, { useState, useEffect } from 'react'
import { MyUploader } from "./MyUploader";
import fileDownload from 'js-file-download'
import Header from './Header';

import 'bootstrap/dist/css/bootstrap.min.css';

const sse = new EventSource('http://localhost:3001/connect');

function App() {

    const [ClientId, SetClientId] = useState(0);
    const [AllFiles, SetAllFiles] = useState([]);

    const size = useScreenSize();

    function resize_app() {
        var app_height = $('#App').height();
        var navbar_height = $('#Navbar').outerHeight();
        $('#cdragndrop').height(app_height - navbar_height);
    }

    useEffect(() => {
        resize_app();
    }, [size]);

    sse.onmessage = e => {
        var data = JSON.parse(e.data.replace(/(?:\\[rn])+/g, ''));
        if(data.clientId !== undefined) {
            SetClientId(data.clientId);
        } else if(data.ready !== undefined) {
            fetch(`http://localhost:3001/download?filename=${data.ready}`)
                .then(resp => resp.blob())
                .then(blob => {
                    fileDownload(blob, `${data.ready}.zip`)
                    var filewithmeta = AllFiles.filter(obj => {
                        return obj.meta.id === data.idx
                    })
                    filewithmeta[0].remove()
                })
        }
        else {
            console.log(data);
        }
    }

    sse.onerror = () => {
        sse.close();
    }

    return (
        <div id="App" className="App h-100">
            <Header />
            <MyUploader clientid={ClientId} setallfiles={SetAllFiles}/>
        </div>
    );
}

export default App;
