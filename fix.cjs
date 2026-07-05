const fs = require('fs');
const path = require('path');
const dir = 'src/Pages/ViewPages/Cards';

fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // reset to clean state by removing all ../
    // well, that's hard to regex perfectly. Let's just fix the known bad ones
    content = content.replace(/\.\.\/\.\.\/\.\.\/\.\.\/store/g, '../../../store');
    content = content.replace(/\.\.\/\.\.\/\.\.\/\.\.\/components/g, '../../../components');
    content = content.replace(/\.\.\/\.\.\/\.\.\/RemovePage/g, '../../RemovePage');
    content = content.replace(/\.\.\/\.\.\/\/\/store/g, '../../../store');
    content = content.replace(/\.\.\/\.\.\/\/\/components/g, '../../../components');
    
    // Also the useStore without store/
    content = content.replace(/\.\.\/\.\.\/\/\/useStore/g, '../../../store/useStore');
    content = content.replace(/\.\.\/\.\.\/\/\/forms/g, '../../../components/forms');
    content = content.replace(/\.\.\/\.\.\/\/\/database/g, '../../../store/database');
    content = content.replace(/\.\.\/\.\.\/\/\/storeStyles/g, '../../../store/storeStyles');
    content = content.replace(/\.\.\/\.\.\/\/\/storePcb/g, '../../../store/storePcb');
    content = content.replace(/\.\.\/\.\.\/\/\/storeTag/g, '../../../store/storeTag');
    content = content.replace(/\.\.\/\.\.\/\/\/storeRework/g, '../../../store/storeRework');
    content = content.replace(/\.\.\/\.\.\/\/\/storeProject/g, '../../../store/storeProject');
    content = content.replace(/\.\.\/\.\.\/\/\/BoardName/g, '../../../components/BoardName');

    fs.writeFileSync(filePath, content);
});
console.log("Fix complete.");
