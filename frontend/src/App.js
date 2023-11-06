import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Button from 'react-bootstrap/Button';
import useScreenSize from 'use-screen-size';
import $ from 'jquery';
import React, { useState, useEffect } from 'react'
import { MyUploader } from "./MyUploader";
import fileDownload from 'js-file-download'

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
        try {
            var data = JSON.parse(e.data.replace(/(?:\\[rn])+/g, ''));
            if(data.clientId !== undefined) {
                SetClientId(data.clientId);
            } else if(data.ready) {
                var filename = `${data.clientid}_${data.jobuuid}.zip`;
                fetch(`http://localhost:3001/download?filename=${data.clientid}/${data.jobuuid}/${filename}`)
                    .then(resp => resp.blob())
                    .then(blob => {
                        fileDownload(blob, `${filename}`)
                        var filewithmeta = AllFiles.filter(obj => {
                            return obj.meta.id === data.jobindex;
                        })
                        filewithmeta[0].remove()
                    })
            }
            else {
                console.log(data);
            }
        }
        catch {
            console.log(e.data);
        }
    }

    sse.onerror = () => {
        sse.close();
    }

    return (
        <div id="App" className="App h-100">
            <Navbar id="Navbar" expand="lg" className="bg-body-tertiary">
                <Container>
                    <Navbar.Brand id="navbrand">
                        <div>
                            <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <h2>Web GPU Rendering</h2>
                        </div>
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="ms-auto">
                        <Nav.Link href="#home">Documentation</Nav.Link>
                        <Nav.Link href="#link">About</Nav.Link>
                        <Button variant="primary">Login</Button>
                    </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
            <div id="cdragndrop" className="cdragndrop">
                <MyUploader clientid={ClientId} setallfiles={SetAllFiles}/>
            </div>
        </div>
    );
}

export default App;
