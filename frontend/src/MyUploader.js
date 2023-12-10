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
                    "walletaddress": data.walletaddress,
                    "memory": 8,
                    "storage": 1,
                    "threads": 4,
                    "workers": 3,
                    "budget": 10,
                    "startprice": 1000,
                    "cpuprice": 1000,
                    "envprice": 1000,
                    "timeoutglobal": 60,
                    "timeoutupload": 5,
                    "timeoutrender": 5,
                    "format": "PNG",
                    "startframe": 1,
                    "stopframe": 840,
                    "stepframe": 1,
                    "whitelist": ["0x8610b20941308fd71a8c96559cf4f87a8a38f5b4", "0xdb17f52f24e213c617381235b6c1a2c577eb8558", "0xcc9a418a2a604f889f46440c74577ffdb8b3e22c"],
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
