import 'react-dropzone-uploader/dist/styles.css'

import Dropzone from 'react-dropzone-uploader'

export const MyUploader = (data) => {

  var params = {"clientid": data.clientid,
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
                "stopframe": 3}

  const getUploadParams = ({ file, meta }) => {
    const body = new FormData()
    body.append('params', JSON.stringify(params))
    body.append('fileField', file)
    return {url: 'http://localhost:3001/upload', body}
  }

  const handleChangeStatus = ({ meta, file }, status) => {
    //console.log(status, meta, file);
  }

  const handleSubmit = (files, allFiles) => {
    //console.log(files.map(f => f.meta))
    allFiles.forEach(f => f.remove())
  }

  return (
    <Dropzone
      getUploadParams={getUploadParams}
      onChangeStatus={handleChangeStatus}
      onSubmit={handleSubmit}
      accept={".blend"}
      maxFiles={1}
      //autoUpload={false}
    />
  )
}

//export default MyUploader;