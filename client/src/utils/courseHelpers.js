// Helper to generate a 2-4 letter prefix from a course title
export const getCoursePrefix = (title = '') => {
    if (!title) return 'PROG';
    const words = title.trim().split(/\s+/).filter(w => w.length > 0);
    
    // If single word, take first 3-4 letters
    if (words.length === 1) {
        return words[0].slice(0, 4).toUpperCase();
    }
    
    // If multiple words, take first letter of each
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
};
