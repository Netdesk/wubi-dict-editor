import {shakeDom, shakeDomFocus} from "./Utility.mjs"
import Vue from '../node_modules/vue/dist/vue.esm.browser.min.js'

const {ipcRenderer} = require('electron')
const { IS_IN_DEVELOP, CONFIG_FILE_PATH, CONFIG_FILE_NAME, DEFAULT_CONFIG } =  require('./js/Global.js')


// Vue 2
const app = {
    el: '#app',
    data() {
        return {
            IS_IN_DEVELOP: IS_IN_DEVELOP, // 是否为开发模式
            fileList: null,
            // { "name": "luna_pinyin.sogou", "path": "luna_pinyin.sogou.dict.yaml" }
            config: DEFAULT_CONFIG
        }
    },
    mounted() {
        this.heightContent = innerHeight - 47 - 20 - 10

        // load file list
        ipcRenderer.on('responseFileList', (event, fileList) => {
            fileList.sort((a,b) => a.name > b.name ? 1: -1)
            this.fileList = fileList
        })
        ipcRenderer.send('requestFileList')

        // config
        ipcRenderer.on('responseConfigFile', (event, config) => {
            this.config = config
        })
        ipcRenderer.send('requestConfigFile')

        onresize = ()=>{
            this.heightContent = innerHeight - 47 - 20 - 10
        }
    },
    methods: {
        setInitFile(file){
            this.config.initFileName = file.path
            this.saveConfig()
        },
        saveConfig(){
            console.log(JSON.stringify(this.config))
            ipcRenderer.send('requestSaveConfig', JSON.stringify(this.config))
        },
        loadConfig(){
            ipcRenderer.send('requestConfigFile')
        }
    },
    watch: {
        config: (newValue)=>{
            console.log(newValue)
        }
    }
}

new Vue(app)
