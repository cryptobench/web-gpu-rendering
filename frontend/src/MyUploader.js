import 'react-dropzone-uploader/dist/styles.css'

import Dropzone from 'react-dropzone-uploader'

const MySubmitButton = (props) => {
    const { className, buttonClassName, style, buttonStyle, disabled, content, onSubmit, files } = props
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
                    "walletaddress": "0x1111111111111111111111111111111111111111",
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
                    "stepframe": 1,
                    "whitelist": ["0x3d1990c8bf4d0462feb6d398789eb93bd170ee6a", "0x3b075306b76da09fdfba5439fc11bf78cb340000", "0xc0d404f279394c2a0ee270df7cf42fec5a15d9d2"],
                    "blacklist": []}

    const getUploadParams = ({ file, meta }) => {
        const body = new FormData()
        params.idx = meta.id;
        body.append('params', btoa(JSON.stringify(params)));
        body.append('fileField', file)
        return {url: 'http://localhost:3001/upload', body}
    }

    const handleSubmit = (files, allFiles) => {
        data.setallfiles(allFiles);
        allFiles.forEach(f => f.restart())
    }

    const handleChangeStatus = ({ meta, file }, status) => {
        if(status === 'aborted')
        {
            meta.percent = 0;
            meta.status = 'ready';
        }
    }

    return (
        <Dropzone
            getUploadParams={getUploadParams}
            onSubmit={handleSubmit}
            accept={".blend"}
            maxFiles={5}
            autoUpload={false}
            canRestart={false}
            canCancel={false}
            onChangeStatus={handleChangeStatus}
            SubmitButtonComponent={MySubmitButton}
        />
    )
}
