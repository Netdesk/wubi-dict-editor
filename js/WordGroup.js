// 词条对象 分组
class WordGroup{
    constructor(groupName, dict) {
        this.groupName = groupName || ''
        this.dict = dict || []
    }
    // 复制一个对象
    clone(){
        return new WordGroup(this.groupName, [...this.dict])
    }
}

export default WordGroup