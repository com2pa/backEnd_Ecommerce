const versionRouter=require('express').Router();
const versionSoftware =require('../package.json')
versionRouter.get('/',(req,res)=>{
    res.status(200).json(versionSoftware)

})
module.exports=versionRouter;