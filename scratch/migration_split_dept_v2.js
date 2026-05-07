const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DeptSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: String,
    block: { type: mongoose.Schema.Types.ObjectId, ref: 'Block' }
});

const Department = mongoose.models.Department || mongoose.model('Department', DeptSchema);

const runMigration = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const oldName = "Corporate Training Relation";
        const newNames = ["Corporate Relations", "Training"];

        // 1. Delete ALL instances of the old name (though it's unique, just to be sure)
        console.log(`Deleting all departments with name: "${oldName}"...`);
        const deleteResult = await Department.deleteMany({ name: oldName });
        console.log(`Deleted ${deleteResult.deletedCount} departments.`);

        // 2. Create new ones if they don't exist
        for (const name of newNames) {
            const exists = await Department.findOne({ name });
            if (!exists) {
                console.log(`Creating department: "${name}"...`);
                await Department.create({ name, description: "Internal/Special Department" });
                console.log('Created.');
            } else {
                console.log(`Department "${name}" already exists.`);
            }
        }

        // 3. Final check
        const allDepts = await Department.find();
        console.log('Current departments in DB:', allDepts.map(d => d.name));

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
