const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Class = require('./models/Class');
const connectDB = require('./config/db');

dotenv.config();

const seedData = async () => {
    try {
        await connectDB();

        console.log('🧹 Clearing existing data...');
        await User.deleteMany({});
        await Class.deleteMany({});

        // Hash password once for bulk insert (bypasses pre-save hook)
        const salt = await bcrypt.genSalt(10);
        const hashedStudentPassword = await bcrypt.hash('student123', salt);
        const hashedTeacherPassword = await bcrypt.hash('teacher123', salt);
        const hashedAdminPassword = await bcrypt.hash('admin123', salt);

        // Create Admin (using insertMany to bypass pre-save hook since password is already hashed)
        const [admin] = await User.insertMany([{
            name: 'Admin User',
            email: 'admin@school.edu',
            password: hashedAdminPassword,
            role: 'admin'
        }]);
        console.log('✅ Admin created:', admin.email);

        // Create 4 Teachers for classes 10A, 10B, 10C, 10D
        const teachersData = [
            { name: 'Mrs. Sunita Verma', email: 'sunita.verma@school.edu', password: hashedTeacherPassword, role: 'teacher', department: 'Mathematics' },
            { name: 'Mr. Amit Sharma', email: 'amit.sharma@school.edu', password: hashedTeacherPassword, role: 'teacher', department: 'English' },
            { name: 'Ms. Priya Patel', email: 'priya.patel@school.edu', password: hashedTeacherPassword, role: 'teacher', department: 'Hindi' },
            { name: 'Mr. Rajesh Kumar', email: 'rajesh.kumar@school.edu', password: hashedTeacherPassword, role: 'teacher', department: 'Science' }
        ];
        const teachers = await User.insertMany(teachersData);
        console.log(`✅ ${teachers.length} Teachers created`);

        // Class configuration
        const classConfig = [
            { className: '10A', subject: 'Mathematics', teacherIndex: 0 },
            { className: '10B', subject: 'English', teacherIndex: 1 },
            { className: '10C', subject: 'Hindi', teacherIndex: 2 },
            { className: '10D', subject: 'Science', teacherIndex: 3 }
        ];

        // Student names pool (80 unique names for 4 classes)
        const allStudentNames = [
            // 10A Students
            'Rohit Sharma', 'Virat Singh', 'Rahul Kapoor', 'Mohit Gupta', 'Sahil Mehta',
            'Nikhil Kumar', 'Ankur Joshi', 'Deepak Khan', 'Suresh Reddy', 'Ramesh Verma',
            'Sneha Iyer', 'Meera Nair', 'Geeta Chopra', 'Suman Desai', 'Rekha Bhatt',
            'Komal Menon', 'Neha Kapoor', 'Shweta Malhotra', 'Manisha Agarwal', 'Sunita Saxena',
            // 10B Students
            'Amit Tiwari', 'Vijay Yadav', 'Rakesh Dubey', 'Sunil Pandey', 'Manoj Mishra',
            'Arun Srivastava', 'Karan Chauhan', 'Ravi Rawat', 'Gaurav Negi', 'Pankaj Bisht',
            'Anjali Thakur', 'Pooja Rawat', 'Simran Kaur', 'Radhika Jain', 'Divya Goyal',
            'Shreya Bansal', 'Tanvi Garg', 'Kritika Seth', 'Aditi Batra', 'Megha Arora',
            // 10C Students
            'Akash Bhatia', 'Rohan Dhawan', 'Tarun Grover', 'Varun Khanna', 'Kunal Luthra',
            'Sanjay Mehra', 'Ajay Nagpal', 'Vishal Oberoi', 'Raj Pahwa', 'Dev Qureshi',
            'Bhavna Rastogi', 'Chhaya Sabharwal', 'Damini Tandon', 'Esha Uppal', 'Falguni Vohra',
            'Garima Walia', 'Harini Xavier', 'Ira Yadav', 'Jaya Zaveri', 'Kamini Ahuja',
            // 10D Students
            'Aarav Sharma', 'Vivaan Patel', 'Aditya Singh', 'Vihaan Gupta', 'Arjun Mehta',
            'Sai Kumar', 'Reyansh Joshi', 'Ayaan Khan', 'Krishna Reddy', 'Ishaan Verma',
            'Ananya Iyer', 'Diya Nair', 'Priya Chopra', 'Saanvi Desai', 'Anika Bhatt',
            'Kavya Menon', 'Riya Kapoor', 'Isha Malhotra', 'Nisha Agarwal', 'Pooja Saxena'
        ];

        const createdClasses = [];

        for (let i = 0; i < classConfig.length; i++) {
            const config = classConfig[i];
            const classStudentNames = allStudentNames.slice(i * 20, (i + 1) * 20);
            const classPrefix = config.className.toLowerCase(); // e.g., '10a', '10b'

            // Create students for this class with class-specific unique emails
            const studentsData = classStudentNames.map((name, index) => ({
                name: name,
                email: `${classPrefix}.student${index + 1}@school.edu`, // e.g., 10a.student1@school.edu
                password: hashedStudentPassword,
                role: 'student',
                rollNumber: `${config.className}${String(index + 1).padStart(3, '0')}`
            }));

            const students = await User.insertMany(studentsData);
            console.log(`✅ ${students.length} Students created for Class ${config.className}`);

            // Create the class
            const newClass = await Class.create({
                className: config.className,
                subject: config.subject,
                teacher: teachers[config.teacherIndex]._id,
                students: students.map(s => s._id)
            });
            createdClasses.push(newClass);
            console.log(`✅ Class "${newClass.className}" created with ${students.length} students`);
        }

        console.log('\n🎉 Seed data created successfully!');
        console.log('\n📝 Login Credentials:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('ADMIN:');
        console.log('  Email: admin@school.edu');
        console.log('  Password: admin123');
        console.log('\nTEACHERS:');
        console.log('  Class 10A: sunita.verma@school.edu (Mathematics)');
        console.log('  Class 10B: amit.sharma@school.edu (English)');
        console.log('  Class 10C: priya.patel@school.edu (Hindi)');
        console.log('  Class 10D: rajesh.kumar@school.edu (Science)');
        console.log('  Password: teacher123');
        console.log('\nSTUDENTS (80 students total - 20 per class):');
        console.log('  Class 10A: 10a.student1@school.edu to 10a.student20@school.edu (Roll: 10A001-10A020)');
        console.log('  Class 10B: 10b.student1@school.edu to 10b.student20@school.edu (Roll: 10B001-10B020)');
        console.log('  Class 10C: 10c.student1@school.edu to 10c.student20@school.edu (Roll: 10C001-10C020)');
        console.log('  Class 10D: 10d.student1@school.edu to 10d.student20@school.edu (Roll: 10D001-10D020)');
        console.log('  Password: student123');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
};

seedData();

