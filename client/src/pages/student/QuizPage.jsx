import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import api from '@/lib/api';

const QuizPage = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const { data } = await api.get(`/student/course/${courseId}`);
                // Extract first quiz from course.quizzes or modules
                let foundQuiz = null;
                if (data.course.quizzes && data.course.quizzes.length > 0) {
                    foundQuiz = data.course.quizzes[0];
                } else if (data.course.modules) {
                    for (const mod of data.course.modules) {
                        const qContent = mod.content.find(c => c.type === 'quiz');
                        if (qContent && qContent.quizId) {
                            // If it's just an ID, we might need a separate fetch, 
                            // but studentController.js populates the first level.
                            foundQuiz = qContent.quizId;
                            break;
                        }
                    }
                }
                
                if (foundQuiz && typeof foundQuiz === 'object') {
                    setQuiz(foundQuiz);
                } else {
                    console.error('No quiz found for this course');
                }
            } catch (error) {
                console.error('Failed to fetch quiz:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();
    }, [courseId]);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading quiz...</div>;
    if (!quiz) return <div className="p-8 text-center text-red-500">Quiz not found for this course.</div>;

    const questions = quiz.questions || [];
    const progress = questions.length > 0 ? ((currentQuestionIdx + 1) / questions.length) * 100 : 0;
    const currentQ = questions[currentQuestionIdx];

    const handleNext = () => {
        const newAnswers = { ...answers, [currentQ._id]: selectedOption };
        setAnswers(newAnswers);

        if (currentQuestionIdx < questions.length - 1) {
            setCurrentQuestionIdx(prev => prev + 1);
            setSelectedOption(answers[questions[currentQuestionIdx + 1]._id] ?? null);
        } else {
            submitQuiz(newAnswers);
        }
    };

    const submitQuiz = async (finalAnswers) => {
        setSubmitting(true);
        try {
            const { data } = await api.post('/student/quiz/submit', {
                courseId,
                quizId: quiz._id,
                answers: finalAnswers
            });
            setResult(data);
        } catch (error) {
            console.error('Failed to submit quiz:', error);
            alert('Failed to submit quiz. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (result) {
        return (
            <div className="max-w-2xl mx-auto py-12 text-center">
                <div className={`inline-flex items-center justify-center h-20 w-20 rounded-full mb-6 ${result.passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    <Icon name={result.passed ? 'CheckCircle' : 'AlertCircle'} size={40} />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    {result.passed ? 'Congratulations!' : 'Keep trying!'}
                </h1>
                <p className="text-lg text-slate-600 mb-8">
                    You scored <span className="font-bold text-slate-900">{result.score}%</span> in {quiz.title}.
                    {result.passed ? ' You have successfully passed the quiz.' : ` You need ${result.passThreshold || Math.max(50, quiz.passingScore || 50)}% to pass.`}
                </p>
                <p className="text-sm text-slate-500 mb-8">
                    Correct answers: {result.correctAnswers}/{result.totalQuestions}
                </p>
                <div className="flex gap-4 justify-center">
                    <Button variant="outline" onClick={() => navigate(`/student/learning/${courseId}`)}>
                        Back to Course
                    </Button>
                    {result.passed && (
                        <Button onClick={() => navigate('/student/certificates')}>
                            View Certificate
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-xl font-bold text-slate-900">{quiz.title}</h1>
                <div className="flex items-center gap-2 text-red-500 font-mono font-bold bg-red-50 px-3 py-1 rounded">
                    <Icon name="Timer" size={16} /> {quiz.timeLimit}:00
                </div>
            </div>

            <div className="mb-8">
                <div className="flex justify-between text-xs font-semibold mb-2">
                    <span>Question {currentQuestionIdx + 1} of {questions.length}</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <ProgressBar value={progress} className="h-2" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg leading-relaxed">
                        {currentQ.questionText}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {currentQ.options.map((option, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelectedOption(option)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedOption === option
                                    ? 'border-brand-blue bg-blue-50 ring-1 ring-brand-blue'
                                    : 'border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${selectedOption === option ? 'border-brand-blue' : 'border-slate-300'
                                    }`}>
                                    {selectedOption === option && <div className="h-2.5 w-2.5 bg-brand-blue rounded-full" />}
                                </div>
                                <span className="text-sm font-medium text-slate-700">{option}</span>
                            </div>
                        </div>
                    ))}
                </CardContent>
                <CardFooter className="justify-end pt-4 border-t border-slate-50">
                    <Button onClick={handleNext} disabled={selectedOption === null || submitting}>
                        {submitting ? 'Submitting...' : currentQuestionIdx === questions.length - 1 ? 'Submit Quiz' : 'Next Question'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default QuizPage;
