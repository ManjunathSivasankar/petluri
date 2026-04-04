import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import api from '@/lib/api';

const QuizPage = () => {
    const { courseId, quizId } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [securityWarning, setSecurityWarning] = useState('');
    const [blurCount, setBlurCount] = useState(0);
    const [timeLeft, setTimeLeft] = useState(null); // Timer state in seconds

    const quizContainerRef = React.useRef(null);

    // Timer Logic
    useEffect(() => {
        if (isFullscreen && quiz && !result && timeLeft === null) {
            setTimeLeft(quiz.timeLimit * 60);
        }

        if (timeLeft === 0 && !submitting && !result) {
            const currentAnswers = { ...answers, [questions[currentQuestionIdx]?._id]: selectedOption };
            submitQuiz(currentAnswers);
            setSecurityWarning('Time up! Auto-submitting quiz.');
        }

        if (timeLeft > 0 && isFullscreen && !result) {
            const timer = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [isFullscreen, quiz, result, timeLeft, submitting]);

    const formatTimer = (seconds) => {
        if (seconds === null) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const handleContextMenu = (e) => e.preventDefault();
        const handleBlur = () => {
            if (!result && !loading) {
                setBlurCount(prev => {
                    const next = prev + 1;
                    if (next >= 3) {
                        setSecurityWarning('Auto-submitting due to multiple tab switches.');
                        // Use a small timeout to allow warning to show before submit
                        setTimeout(() => {
                            if (quiz && quiz.questions && !submitting) {
                                const qList = quiz.questions;
                                const currentAnswers = { ...answers, [qList[currentQuestionIdx]._id]: selectedOption };
                                submitQuiz(currentAnswers);
                            }
                        }, 2000);
                    } else {
                        setSecurityWarning(`Warning: Tab switching is not allowed. (${next}/3)`);
                    }
                    return next;
                });
            }
        };

        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('blur', handleBlur);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('blur', handleBlur);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [result, loading, quiz, answers, selectedOption, currentQuestionIdx, submitting]);

    useEffect(() => {
        if (securityWarning) {
            const timer = setTimeout(() => setSecurityWarning(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [securityWarning]);

    const enterFullscreen = () => {
        if (quizContainerRef.current) {
            quizContainerRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        }
    };

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const { data } = await api.get(`/student/quiz/${courseId}/${quizId}`);
                if (data.quiz) {
                    setQuiz(data.quiz);
                } else {
                    console.error('No quiz found');
                }
            } catch (error) {
                console.error('Failed to fetch quiz:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();
    }, [courseId, quizId]);

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
        console.log('Submitting quiz for course:', courseId, 'quiz:', quiz._id);
        try {
            const { data } = await api.post('/student/quiz/submit', {
                courseId,
                quizId: quiz._id,
                answers: finalAnswers
            });
            console.log('Quiz submission result:', data);
            
            if (data.passed) {
                console.log('Quiz passed, triggering module completion feedback.');
            } else {
                console.log('Quiz failed, threshold:', data.passThreshold);
            }

            setResult(data);
        } catch (error) {
            console.error('Failed to submit quiz:', error);
            alert('Failed to submit quiz. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div ref={quizContainerRef} className={`min-h-screen ${isFullscreen ? 'bg-slate-50' : ''}`}>
            {/* Security Warning Overlay */}
            {securityWarning && (
                <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[9999] bg-red-600 text-white px-6 py-3 rounded-lg shadow-2xl font-bold animate-pulse">
                    {securityWarning}
                </div>
            )}

            {!isFullscreen && !result ? (
                <div className="max-w-2xl mx-auto py-20 text-center">
                    <Icon name="Shield" size={64} className="mx-auto mb-6 text-blue-500 opacity-80" />
                    <h1 className="text-3xl font-bold text-slate-900 mb-4">Secure Assessment Environment</h1>
                    <p className="text-slate-600 mb-8 px-4">
                        To maintain the integrity of this assessment, you must enter fullscreen mode. 
                        Tab switching or exiting fullscreen will result in warnings and eventual auto-submission.
                    </p>
                    <Button size="lg" className="px-10 py-6 text-lg font-bold rounded-xl shadow-xl shadow-blue-900/20" onClick={enterFullscreen}>
                        Enter Secure Mode & Start
                    </Button>
                </div>
            ) : result ? (
                <div className="max-w-2xl mx-auto py-12 px-4 text-center">
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
            ) : (
                <div className="max-w-3xl mx-auto py-8 px-4">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-xl font-bold text-slate-900">{quiz.title}</h1>
                        <div className="flex items-center gap-2 text-red-500 font-mono font-bold bg-red-50 px-3 py-1 rounded">
                            <Icon name="Timer" size={16} /> {quiz.timeLimit}:00
                        </div>
                    </div>

                    <div className="mb-8">
                        <div className="flex justify-between text-xs font-semibold mb-2 text-slate-500 uppercase tracking-wider">
                            <span>Question {currentQuestionIdx + 1} of {questions.length}</span>
                            <span>{Math.round(progress)}% Complete</span>
                        </div>
                        <ProgressBar value={progress} className="h-2.5 rounded-full" />
                    </div>

                    <Card className="shadow-lg border-slate-200">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                            <CardTitle className="text-lg leading-relaxed text-slate-800">
                                {currentQ.questionText}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 p-6">
                            {currentQ.options.map((option, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedOption(option)}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${selectedOption === option
                                            ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedOption === option ? 'border-blue-500' : 'border-slate-300'
                                            }`}>
                                            {selectedOption === option && <div className="h-3 w-3 bg-blue-500 rounded-full" />}
                                        </div>
                                        <span className={`text-base font-medium ${selectedOption === option ? 'text-blue-900' : 'text-slate-700'}`}>{option}</span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter className="justify-end p-6 bg-slate-50/30 border-t border-slate-100">
                            <Button size="lg" className="px-8 shadow-md" onClick={handleNext} disabled={selectedOption === null || submitting}>
                                {submitting ? 'Submitting...' : currentQuestionIdx === questions.length - 1 ? 'Submit Quiz' : 'Next Question'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default QuizPage;
