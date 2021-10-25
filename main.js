const {app, BrowserWindow, Menu, ipcMain, shell, dialog} = require('electron')
const { exec } = require('child_process')
const fs = require('fs')
const os = require('os')
const url = require("url")
const path = require("path")
const {shakeDom, log, shakeDomFocus} = require('./js/Utility')
const { IS_IN_DEVELOP, CONFIG_FILE_PATH, CONFIG_FILE_NAME, DEFAULT_CONFIG, CONFIG_DICT_MAP_FILE_NAME } =  require('./js/Global')
const DictMap = require('./js/DictMap')

let mainWindow // 主窗口
let fileList = [] // 文件目录列表，用于移动词条

function createMainWindow() {
    let width = IS_IN_DEVELOP ? 1400: 800
    let height = IS_IN_DEVELOP ? 600: 600
    mainWindow = new BrowserWindow({
        width,
        height,
        icon: __dirname + '/assets/appIcon/appicon.ico', // windows icon
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    if (IS_IN_DEVELOP){
        mainWindow.webContents.openDevTools() // 打开调试窗口
    }

    mainWindow.loadURL(
        url.format({
            pathname: path.join(__dirname, './view/index/index.html'),
            protocol: "file:",
            slashes: true
        })
    )
    mainWindow.on('closed', function () {
        mainWindow = null
        if (configWindow) configWindow.close()
        if (toolWindow) toolWindow.close()
    })


    // 保存词库到文件
    ipcMain.on('saveFile', (event, filename, yamlString) => {
        fs.writeFile(path.join(getRimeConfigDir(), filename), yamlString, {encoding: "utf8"}, err => {
            if (!err){
                log('saveFileSuccess')
                applyRime() // 布署
                mainWindow.webContents.send('saveFileSuccess')
            }
        })
    })

    // 监听 window 的文件载入请求
    ipcMain.on('loadInitDictFile', event => {
        let config = readConfigFile()
        readFileFromConfigDir(config.initFileName)
    })

    // 监听载入主文件内容的请求
    ipcMain.on('loadDictFile', (event,filename) => {
        readFileFromConfigDir(filename)
    })

    // 监听载入次文件内容的请求
    ipcMain.on('MainWindow:LoadSecondDict', (event, filename) => {
        let filePath = path.join(getRimeConfigDir(), filename)
        fs.readFile(filePath, {encoding: 'utf-8'}, (err, res) => {
            if(err){
                log(err)
            } else {
                mainWindow.webContents.send('setTargetDict', filename, filePath, res)
            }
        })
    })

    // 监听载入主文件内容的请求
    ipcMain.on('loadMainDict', event => {
        let mainDictFileName = 'wubi86_jidian.dict.yaml'
        fs.readFile(path.join(getRimeConfigDir(), mainDictFileName), {encoding: 'utf-8'}, (err, res) => {
            if(err){
                log(err)
            } else {
                mainWindow.webContents.send('setMainDict', path.join(getRimeConfigDir(), mainDictFileName) ,res)
            }
        })
    })

    // 外部打开当前码表文件
    ipcMain.on('openFileOutside', (event, filename) => {
        shell.openPath(path.join(getRimeConfigDir(), filename)).then(res => {
            log(res)
        }).catch(err => {
            log(err)
        })
    })
    ipcMain.on('GetFileList', event => {
        mainWindow.send('FileList', fileList)
    })

    // config 相关，载入配置文件内容
    ipcMain.on('MainWindow:RequestConfigFile', event => {
        let config = readConfigFile() // 没有配置文件时，返回 false
        if (config){ // 如果有配置文件
            mainWindow.send('MainWindow:ResponseConfigFile', config) // 向窗口发送 config 内容
        }
    })
    // 保存配置文件内容
    ipcMain.on('saveConfigFileFromMainWindow', (event, configString) => {
        writeConfigFile(configString, mainWindow)
    })

    ipcMain.on('getDictMap', event => {
        let dictMapFilePath = path.join(getAppConfigDir(), CONFIG_DICT_MAP_FILE_NAME)
        let dictMapFileContent = readFileFromDisk(dictMapFilePath)
        if (dictMapFileContent){
            let dictMap = new DictMap(dictMapFileContent, CONFIG_DICT_MAP_FILE_NAME, dictMapFilePath)
            if (mainWindow) mainWindow.send('setDictMap', dictMap.characterMap)
            if (toolWindow) toolWindow.send('setDictMap', dictMap.characterMap)
        }
    })
}

let toolWindow
function showToolWindow (){
    let width = IS_IN_DEVELOP ? 1400: 1000
    let height = IS_IN_DEVELOP ? 600: 600
    toolWindow = new BrowserWindow({
        width,
        height,
        icon: __dirname + '/assets/appIcon/appicon.ico', // windows icon
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    if (IS_IN_DEVELOP){
        toolWindow.webContents.openDevTools() // 打开调试窗口
    }

    toolWindow.loadURL(
        url.format({
            pathname: path.join(__dirname, 'view/tool/tool.html'),
            protocol: "file:",
            slashes: true
        })
    )
    toolWindow.on('closed', function () {
        let listeners = [
            'ToolWindow:RequestConfigFile',
            'ToolWindow:chooseDictFile',
            'ToolWindow:SaveFile',
            'ToolWindow:loadFileContent',
            'ToolWindow:openFileOutside',
            'ToolWindow:GetFileList',
            'ToolWindow:LoadTargetDict'
        ]
        listeners.forEach(item => {
            ipcMain.removeAllListeners(item)
        })
        toolWindow = null
    })



    // 选取码表文件目录
    ipcMain.on('ToolWindow:chooseDictFile', event => {
        let dictFilePath = dialog.showOpenDialogSync(toolWindow,{
            filters: [
                { name: 'Text', extensions: ['text', 'txt', 'yaml'] },
            ],
            properties: ['openFile'] // 选择文件
        })
        console.log(dictFilePath)
        if (dictFilePath){
            readFileFromDiskAndResponse(dictFilePath[0], toolWindow)
        }
    })


    // 保存词库到文件
    ipcMain.on('ToolWindow:SaveFile', (event, filePath, fileConentString) => {
        fs.writeFile(filePath, fileConentString, {encoding: "utf8"}, err => {
            if (!err){
                log('saveFileSuccess')
                // applyRime() // 布署
                toolWindow.webContents.send('saveFileSuccess')
            }
        })
    })

    // 监听 window 的文件载入请求
    ipcMain.on('ToolWindow:loadFileContent', (event, filePath) => {
        readFileFromDiskAndResponse( filePath, toolWindow)
    })

    // 外部打开当前码表文件
    ipcMain.on('ToolWindow:openFileOutside', (event, filename) => {
        shell.openPath(path.join(getRimeConfigDir(), filename)).then(res => {
            log(res)
        }).catch(err => {
            log(err)
        })
    })

    ipcMain.on('ToolWindow:GetFileList', event => {
        toolWindow.send('ToolWindow:FileList', fileList)
    })

    // 监听载入次文件内容的请求
    ipcMain.on('ToolWindow:LoadTargetDict', (event, filename) => {
        let filePath = path.join(getRimeConfigDir(), filename)
        fs.readFile(filePath, {encoding: 'utf-8'}, (err, res) => {
            if(err){
                log(err)
            } else {
                toolWindow.webContents.send('ToolWindow:SetTargetDict',filename, filePath ,res)
            }
        })
    })

    // config 相关
    ipcMain.on('ToolWindow:RequestConfigFile', event => {
        let config = readConfigFile() // 没有配置文件时，返回 false

        if (config){ // 如果有配置文件
            if (toolWindow){ // 如果有配置文件
                toolWindow.send('ToolWindow:ResponseConfigFile', config) // 向窗口发送 config 内容
            }
        }
    })
}


// 读取文件 从硬盘
function readFileFromDisk(filePath){
    let fileContent = fs.readFileSync(filePath, {encoding: 'utf-8'})
        if(!fileContent){
            return false
        } else {
            return fileContent
        }
}

// 读取文件并回馈给指定窗口
function readFileFromDiskAndResponse(filePath, responseWindow){
    let fileName = path.basename(filePath) // 获取文件名
    let fileContent = readFileFromDisk(filePath)
    if (fileContent){
        responseWindow.send('showFileContent', fileName, filePath, fileContent)
    } else {
        log('读取文件错误')
    }
}



let configWindow
function createConfigWindow() {
    let width = IS_IN_DEVELOP ? 1400 : 600
    let height = IS_IN_DEVELOP ? 600 : 600
    // TODO：打开配置窗口的时候，先创建配置文件夹，供后面保存配置文件和字典文件使用

    // 判断 config 文件夹是否存在
    let configDir = getAppConfigDir()
    console.log(configDir)
    if (!fs.existsSync(configDir)){
        console.log('create config dir', configDir)
        fs.mkdirSync(configDir) // 创建目录

    }

    configWindow = new BrowserWindow({
        width,
        height,
        icon: __dirname + '/assets/appIcon/appicon.ico', // windows icon
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    if (IS_IN_DEVELOP) {
        configWindow.webContents.openDevTools() // 打开调试窗口
    }


    configWindow.loadURL(
        url.format({
            pathname: path.join(__dirname, 'view/config/config.html'),
            protocol: "file:",
            slashes: true
        })
    )
    configWindow.on('closed', function () {
        let listeners = [
            'requestFileList',
            'ConfigWindow:RequestSaveConfig',
            'ConfigWindow:ChooseRimeHomeDir',
            'ConfigWindow:SetDictMapFile',
        ]
        listeners.forEach(item => {
            ipcMain.removeAllListeners(item)
        })
        configWindow = null
    })

    // 载入文件列表
    ipcMain.on('requestFileList', event => {
        configWindow.send('responseFileList', fileList)
    })

    // config 相关
    ipcMain.on('ConfigWindow:RequestConfigFile', event => {
        let config = readConfigFile() // 没有配置文件时，返回 false
        if (config){ // 如果有配置文件
            if (configWindow){ // 如果有配置文件
                configWindow.send('ConfigWindow:ResponseConfigFile', config) // 向窗口发送 config 内容
            }
        }
    })

    // 保存配置文件内容
    ipcMain.on('ConfigWindow:RequestSaveConfig', (event, configString) => {
        writeConfigFile(configString)
    })

    // 选取配置文件目录
    ipcMain.on('ConfigWindow:ChooseRimeHomeDir', event => {
        let rimeHomeDir = dialog.showOpenDialogSync(configWindow,{
            properties: ['openDirectory'] // 选择文件夹
        })
        if (rimeHomeDir){
            configWindow.send('ConfigWindow:ChoosenRimeHomeDir', rimeHomeDir)
        }
    })

    // 选取编码字典文件
    ipcMain.on('ConfigWindow:SetDictMapFile', event => {
        // 获取文件码表文件路径，返回值为路径数组
        let dictMapPathArray = dialog.showOpenDialogSync(configWindow,{
            defaultPath: getRimeConfigDir(), // 默认为 Rime 配置文件目录
            filters: [
                { name: '码表文件', extensions: ['text', 'txt', 'yaml'] },
            ],
            properties: ['openFile'] // 选择文件夹
        })
        if (dictMapPathArray.length > 0){
            let filePath = dictMapPathArray[0]
            let fileName = path.basename(filePath) // 获取文件名
            let fileContent = readFileFromDisk(filePath)
            if (fileContent){
                configWindow.send('ConfigWindow:ShowDictMapContent', fileName, filePath, fileContent)
            } else {
                log('读取码表字典文件错误')
            }
        }
    })

    // 保存 DictMap 文件
    ipcMain.on('ConfigWindow:SaveDictMapFile', ( event, fileContentString) => {
        let configPath = getAppConfigDir()
        console.log(configPath)
        fs.writeFile(
            path.join(configPath, CONFIG_DICT_MAP_FILE_NAME),
            fileContentString,
            {encoding: 'utf-8'},
            err => {
                if (err) {
                    log(err)
                } else {
                    configWindow.send('ConfigWindow:SaveDictMapSuccess')
                }
            })
    })
}


// config 文件保存在 用户文件夹下 / CONFIG_FILE_PATH/CONFIG_FILE_NAME 文件中
function writeConfigFile(contentString){
    let configPath = getAppConfigDir()
    fs.writeFile(
        path.join(configPath, CONFIG_FILE_NAME),
        contentString, {encoding: 'utf-8'},
        err => {
            if (err) {
                log(err)
            } else {
                // 配置保存成功后，向主窗口发送配置文件内容
                if (toolWindow) toolWindow.send('ToolWindow:ResponseConfigFile', JSON.parse(contentString)) // 向窗口发送 config 内容
                if (mainWindow) mainWindow.send('MainWindow:ResponseConfigFile', JSON.parse(contentString)) // 向窗口发送 config 内容
            }
        })
}

function readConfigFile(){
    let configPath = path.join(os.homedir(), CONFIG_FILE_PATH)
    try{ // 捕获读取文件时的错误，如果有配置文件 返回其内容，如果没有，返回  false
        let result = fs.readFileSync(path.join(configPath, CONFIG_FILE_NAME), {encoding: 'utf-8'})
        return JSON.parse(result)
    } catch (err){
        return DEFAULT_CONFIG
    }
}

app.on('ready', ()=>{
    createMainWindow()
    setRimeFolderMenu()
})

app.on('window-all-closed', function () {
    // if (process.platform !== 'darwin') app.quit()
    app.quit()
})

app.on('activate', function () {
    if (mainWindow === null) {
        createMainWindow()
    }
})

// 读取文件 从配置文件目录
function readFileFromConfigDir(fileName, responseWindow){
    let rimeHomeDir = getRimeConfigDir()
    let filePath = path.join(rimeHomeDir, fileName)
    fs.readFile(filePath, {encoding: 'utf-8'}, (err, res) => {
        if(err){
            log(err)
        } else {
            if(responseWindow){
                responseWindow.send('showFileContent', fileName, filePath, res)
            } else {
                mainWindow.webContents.send('showFileContent', fileName, filePath, res)
            }
        }
    })
}


// 匹配文件名，返回对应文件的名字
function getLabelNameFromFileName(fileName){
    let map = [
        {name: '拼音词库', path: 'pinyin_simp.dict.yaml'},
        {name: '⒈ 五笔极点 - 主表', path: 'wubi86_jidian.dict.yaml'},
        {name: '⒉ 五笔极点 - 临时', path: 'wubi86_jidian_addition.dict.yaml'},
        {name: '⒊ 五笔极点 - 附加', path: 'wubi86_jidian_extra.dict.yaml'},
        {name: '⒋ 五笔极点 - 用户', path: 'wubi86_jidian_user.dict.yaml'},
        {name: '⒌ 五笔极点 - 英文', path: 'wubi86_jidian_english.dict.yaml'},

        // 测试词库
        {name: '测试 - 主表 ⛳', path: 'test_main.dict.yaml'},
        {name: '测试 - 分组 ⛳', path: 'test_group.dict.yaml'},
        {name: '测试 - 普通 ⛳', path: 'test.dict.yaml'},
    ]
    let matchedPath = map.filter(item => item.path === fileName)
    // 返回匹配的名字，或者返回原文件名
    return matchedPath.length > 0 ? matchedPath[0].name: fileName.substring(0, fileName.indexOf('.dict.yaml'))
}



// 创建 menu
function createMenu(filesMenu) {
    let menuStructure = [
        {
            label: '词库工具',
            submenu: [
                {
                    label: '配置',
                    click() {
                        createConfigWindow()
                    }
                },
                {
                    label: '刷新', // 刷新页面
                    click() {
                        refreshWindows()
                    }
                },
            ]
        },
        {
            label: '编辑',
            role: 'editMenu'
        },
        {
            label: '选择词库',
            submenu: filesMenu
        },
        {
            label: '布署',
            submenu: [
                {
                    label: '重新布署',
                    click() {
                        applyRime()
                    }
                },
            ]
        },
        {
            label: '文件夹',
            submenu: [
                {label: '打开 Rime 配置文件夹', click() {shell.openPath(getRimeConfigDir())}},
                {label: '打开 Rime 程序文件夹', click() {shell.openPath(getRimeExecDir())}},
                {
                    label: '打开工具配置文件夹', click() {
                        let configDir = path.join(os.homedir(), CONFIG_FILE_PATH)
                        shell.openPath(configDir)
                    }
                },
            ]
        },
        {
            label: '码表处理',
            submenu: [
                {
                    label: '码表处理工具',
                    click() {
                        showToolWindow()
                    }
                },
            ]
        },
        {
            label: '关于',
            submenu: [
                {label: '最小化', role: 'minimize'},
                {label: '关于', role: 'about'},
                {type: 'separator'},
                {label: '退出', role: 'quit'},
            ]
        },
    ]
    if(IS_IN_DEVELOP){
/*        menuStructure.push(

        )*/
    }
    let menu = Menu.buildFromTemplate(menuStructure)
    Menu.setApplicationMenu(menu)
}

// 刷新所有窗口内容
function refreshWindows(){
    if(mainWindow) mainWindow.reload()
    if(configWindow) configWindow.reload()
    if(toolWindow) toolWindow.reload()
}

// 设置菜单 - Rime 所有文件
function setRimeFolderMenu(){
    let rimeFolderPath = getRimeConfigDir()
    fs.readdir(rimeFolderPath,(err, filePaths) => {
        if (err) {
            log(err)
        } else {
            let filesMenu = []
            // 筛选 .yaml 文件
            let yamlFileList = filePaths.filter(item => item.indexOf('.dict.yaml') > 0)
            // 匹配获取上面提前定义的文件名
            fileList = yamlFileList.map(item => {
                return {
                    name: getLabelNameFromFileName(item),
                    path: item
                }
            })
            // 排序路径
            fileList.sort((a,b) => a.name > b.name ? 1: -1)
            // 添加菜单
            fileList.forEach(item => {
                filesMenu.push({
                    label: item.name,
                    click(sender, window, content) {
                        window.title = sender.label // 点击对应菜单时，显示当前编辑词库的名字
                        readFileFromConfigDir(item.path)
                    }
                },)
            })
            createMenu(filesMenu)
        }
    })
}

// 布署 Rime
function applyRime(){
    let rimeBinDir = getRimeExecDir()
    log(path.join(rimeBinDir,'WeaselDeployer.exe'))
    switch (os.platform()){
        case 'darwin':
            // macOS
            exec(`"${rimeBinDir}/Squirrel" --reload`, error => {
                log(error)
            })
            break
        case 'win32':
            // windows
            let execFilePath = path.join(rimeBinDir,'WeaselDeployer.exe')
            exec(`"${execFilePath}" /deploy`, err => {
                if (err){
                    log(err)
                }
            })
    }
}

// 根据系统返回 rime 配置路径
function getRimeConfigDir(){
    let userHome = os.homedir()
    let config = readConfigFile()
    if (!config.rimeHomeDir){ // 没有设置配置文件目录时
        switch (os.platform()){
            case 'aix': break
            case 'darwin': return path.join(userHome + '/Library/Rime') // macOS
            case 'freebsd': break
            case 'linux': break
            case 'openbsd': break
            case 'sunos': break
            case 'win32': return path.join(userHome + '/AppData/Roaming/Rime') // windows
        }
    } else {
        return config.rimeHomeDir
    }
}

function getAppConfigDir(){
    return  path.join(os.homedir(), CONFIG_FILE_PATH)
}

// 返回  Rime 可执行文件夹
function getRimeExecDir(){
    switch (os.platform()){
        case 'aix': break
        case 'darwin':  // macOS
            return path.join('/Library/Input Methods/Squirrel.app', 'Contents/MacOS')
        case 'freebsd': break
        case 'linux': break
        case 'openbsd': break
        case 'sunos': break
        case 'win32': // windows
            const PATH_RIME_BIN_WIN = 'C:/Program Files (x86)/Rime'
            let execDirEntes = fs.readdirSync(PATH_RIME_BIN_WIN, {withFileTypes: true})
            // 获取路径中 weasel 版本文件夹
            // TODO：后续可能需要处理多版本的时候获取最新版本
            let rimeDirEntes = execDirEntes.filter(item => item.name.includes('weasel'))
            return path.join(PATH_RIME_BIN_WIN, rimeDirEntes[0].name)
    }

}
