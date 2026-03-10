const express = require('express');
const router = express.Router();
const { getPublicCourses, getSingleCourse, verifyCertificate } = require('../controllers/publicController');

router.get('/', getPublicCourses);
router.get('/:id', getSingleCourse);
router.get('/verify/:certificateId', verifyCertificate);

module.exports = router;
