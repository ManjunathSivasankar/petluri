export const validateProgram = (formData) => {
    const checks = {
        basics: { label: "Program Details", items: [], isValid: false },
        content: { label: "Curriculum & Content", items: [], isValid: false },
        settings: { label: "Settings", items: [], isValid: true }, // Default valid for now
    };

    // 1. Basics
    const hasTitle = !!formData.title;
    const hasDesc = !!formData.description;
    const hasType = !!formData.type;
    const hasLevel = !!formData.level;
    const hasDuration = !!formData.duration;
    const hasPrice = formData.type === 'free' ? true : (formData.price && Number(formData.price) > 0);

    checks.basics.items.push({ label: "Program Title", valid: hasTitle });
    checks.basics.items.push({ label: "Description", valid: hasDesc });
    checks.basics.items.push({ label: "Program Type", valid: hasType });
    checks.basics.items.push({ label: "Difficulty Level", valid: hasLevel });
    checks.basics.items.push({ label: "Duration", valid: hasDuration });

    if (formData.type !== 'free') {
        checks.basics.items.push({ label: "Price > 0", valid: hasPrice });
    } else {
        checks.basics.items.push({ label: "Free (Price 0)", valid: true });
    }

    checks.basics.isValid = hasTitle && hasDesc && hasType && hasLevel && hasDuration && hasPrice;

    // 2. Content
    if (formData.type === 'internship') {
        checks.content.items.push({ label: "Internship details (No video required)", valid: true });
        checks.content.isValid = true;
    } else {
        const hasModules = formData.modules && formData.modules.length > 0;
        checks.content.items.push({ label: "At least 1 Module", valid: hasModules });

        let allModulesValid = true;

        if (hasModules) {
            formData.modules.forEach((m, idx) => {
                const hasModTitle = !!m.title;
                const hasModDesc = !!m.description;
                const hasContent = m.content && m.content.length > 0;
                const hasVideo = hasContent && m.content.some(c => c.type === 'video');

                if (!hasModTitle || !hasModDesc) {
                    allModulesValid = false;
                    checks.content.items.push({ label: `Module ${idx + 1}: Needs Title & Description`, valid: false });
                } else if (!hasVideo) {
                    allModulesValid = false;
                    checks.content.items.push({ label: `Module ${idx + 1}: Needs 1+ video`, valid: false });
                } else {
                    checks.content.items.push({ label: `Module ${idx + 1}: Valid`, valid: true });
                }
            });
        } else {
            allModulesValid = false;
        }

        checks.content.isValid = hasModules && allModulesValid;
    }

    const isReady = Object.values(checks).every(s => s.isValid);

    return { checks, isReady };
};
