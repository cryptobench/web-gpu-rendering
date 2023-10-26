import 'react-dropzone-uploader/dist/styles.css'

import Dropzone from 'react-dropzone-uploader'

const MySubmitButton = (props) => {
    const { className, buttonClassName, style, buttonStyle, disabled, content, onSubmit, files } = props
    // preparing, ready, getting_upload_params, uploading, headers_received, done
    const _disabled = files.some(f => ['preparing', 'getting_upload_params', 'uploading', 'headers_received', 'done'].includes(f.meta.status)) || !files.some(f => ['ready'].includes(f.meta.status))

    const handleSubmit = () => {
        onSubmit(files.filter(f => ['ready'].includes(f.meta.status)))
    }

    return (
        <div className={className} style={style}>
            <button className={buttonClassName} style={buttonStyle} onClick={handleSubmit} disabled={disabled || _disabled}>
                {content}
            </button>
        </div>
    )
}

export const MyUploader = (data) => {

    var params = {  "clientid": data.clientid,
                    "subnettag": "norbert",
                    "paymentdriver": "erc20",
                    "paymentnetwork": "goerli",
                    "memory": 8,
                    "storage": 1,
                    "threads": 4,
                    "workers": 3,
                    "budget": 1,
                    "startprice": 1000,
                    "cpuprice": 1000,
                    "envprice": 1000,
                    "timeoutglobal": 4,
                    "timeoutupload": 5,
                    "timeoutrender": 5,
                    "format": "PNG",
                    "startframe": 1,
                    "stopframe": 3,
                    "stepframe": 1}

    const getUploadParams = ({ file, meta }) => {
        const body = new FormData()
        params.idx = `"${meta.id}"`;
        body.append('params', JSON.stringify(params))
        body.append('fileField', file)
        return {url: 'http://localhost:3001/upload', body}
    }

    const handleChangeStatus = ({ meta, file }, status) => {
        //console.log(status, meta, file);
    }

    const handleSubmit = (files, allFiles) => {
        data.setallfiles(allFiles);
        allFiles.forEach(f => f.restart())
    }

    return (
        <div id="cdragndrop" className="cdragndrop flex h-screen">
            <Dropzone
                classNames={{ 
                    dropzone: "border-[3px] border-[#808080] border-dashed overflow-hidden h-[25%] w-[50%] m-auto rounded-[10px]",
                    // inputLabel: "bg-black"
                }}
                styles={{
                    inputLabel: {height: "100%", position: 'relative'/*, background: 'black'*/}
                }}
                getUploadParams={getUploadParams}
                onChangeStatus={handleChangeStatus}
                onSubmit={handleSubmit}
                //accept={".blend"}
                maxFiles={5}
                autoUpload={false}
                canRestart={false}
                canCancel={false}
                //canRemove={false}
                SubmitButtonComponent={MySubmitButton}
            />
        </div>
    )
}
