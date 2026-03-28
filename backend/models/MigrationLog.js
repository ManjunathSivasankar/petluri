const mongoose = require('mongoose');

const migrationLogSchema = new mongoose.Schema({
    oldId: { 
        type: String 
    },
    newId: { 
        type: String, 
        required: true 
    },
    entity: { 
        type: String, 
        required: true,
        enum: ['student', 'program', 'certificate', 'module', 'video', 'quiz']
    },
    originalDocId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('MigrationLog', migrationLogSchema);
