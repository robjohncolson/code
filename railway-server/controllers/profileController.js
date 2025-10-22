import { createClient } from '@supabase/supabase-js';
import {
    ValidationError,
    NotFoundError,
    ConflictError,
    AuthorizationError,
    asyncHandler,
    handleSupabaseError
} from '../middleware/errorHandler.js';
import { generateToken, createAnonymousSession } from '../middleware/auth.js';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

/**
 * Create a new user profile
 * POST /api/profiles
 */
export const createProfile = asyncHandler(async (req, res) => {
    const { username, class_section_code } = req.body;

    // Validate username format (Fruit_Animal pattern suggested)
    const usernamePattern = /^[A-Za-z0-9_]+$/;
    if (!usernamePattern.test(username)) {
        throw new ValidationError('Invalid username format', [{
            field: 'username',
            message: 'Username must contain only letters, numbers, and underscores'
        }]);
    }

    // Check for PII in username
    const emailPattern = /\S+@\S+\.\S+/;
    const phonePattern = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/;
    if (emailPattern.test(username) || phonePattern.test(username)) {
        throw new ValidationError('Username cannot contain personal information', [{
            field: 'username',
            message: 'Please use an anonymous username like Fruit_Animal format'
        }]);
    }

    try {
        // Start transaction
        let classSection = null;

        // If class code provided, verify it exists
        if (class_section_code) {
            const { data: sections, error: sectionError } = await supabase
                .from('class_sections')
                .select('id')
                .eq('section_code', class_section_code)
                .single();

            if (sectionError || !sections) {
                throw new ValidationError('Invalid class section code', [{
                    field: 'class_section_code',
                    message: 'Class section not found'
                }]);
            }

            classSection = sections;
        }

        // Create profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert({
                username: username,
                is_teacher: false,
                class_section_id: classSection?.id || null
            })
            .select()
            .single();

        if (profileError) {
            if (profileError.code === '23505') { // Unique violation
                throw new ConflictError('Username already exists', 'profile');
            }
            throw handleSupabaseError(profileError);
        }

        // Generate JWT token for the new profile
        const token = createAnonymousSession(username, classSection?.id);

        // Return profile and token
        res.status(201).json({
            success: true,
            token: token,
            profile: {
                username: profile.username,
                is_teacher: profile.is_teacher,
                class_section_id: profile.class_section_id,
                total_questions_answered: profile.total_questions_answered || 0,
                total_votes_received: profile.total_votes_received || 0,
                badges_earned: profile.badges_earned || 0,
                created_at: profile.created_at
            }
        });

    } catch (error) {
        throw handleSupabaseError(error) || error;
    }
});

/**
 * Get user profile by username
 * GET /api/profiles/:username
 */
export const getProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    try {
        // Fetch profile with class section info
        const { data: profile, error } = await supabase
            .from('profiles')
            .select(`
                *,
                class_sections (
                    id,
                    section_name,
                    section_code
                )
            `)
            .eq('username', username)
            .single();

        if (error || !profile) {
            throw new NotFoundError('Profile', username);
        }

        // Check if requester can see full details
        const isOwner = req.user?.username === username;
        const isTeacher = req.user?.is_teacher;
        const sameClass = req.user?.class_section_id === profile.class_section_id;

        // Build response based on permissions
        const response = {
            username: profile.username,
            is_teacher: profile.is_teacher,
            total_questions_answered: profile.total_questions_answered,
            total_votes_received: profile.total_votes_received,
            badges_earned: profile.badges_earned,
            created_at: profile.created_at,
            updated_at: profile.updated_at
        };

        // Add sensitive fields if authorized
        if (isOwner || isTeacher || sameClass) {
            response.class_section = profile.class_sections ? {
                id: profile.class_sections.id,
                name: profile.class_sections.section_name,
                code: profile.class_sections.section_code
            } : null;
            response.current_unit = profile.current_unit;
            response.current_lesson = profile.current_lesson;
            response.avatar_config = profile.avatar_config;
        }

        res.json(response);

    } catch (error) {
        throw handleSupabaseError(error) || error;
    }
});

/**
 * Update user profile
 * PATCH /api/profiles/:username
 */
export const updateProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;
    const updates = req.body;

    // Check ownership
    if (req.user.username !== username && !req.user.is_teacher) {
        throw new AuthorizationError('You can only update your own profile');
    }

    // Prevent escalation to teacher
    if ('is_teacher' in updates) {
        delete updates.is_teacher;
    }

    // Allowed fields for update
    const allowedFields = ['current_unit', 'current_lesson', 'avatar_config'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
        if (field in updates) {
            filteredUpdates[field] = updates[field];
        }
    }

    if (Object.keys(filteredUpdates).length === 0) {
        throw new ValidationError('No valid fields to update');
    }

    try {
        // Update profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .update(filteredUpdates)
            .eq('username', username)
            .select()
            .single();

        if (error) {
            throw handleSupabaseError(error);
        }

        if (!profile) {
            throw new NotFoundError('Profile', username);
        }

        res.json({
            success: true,
            profile: {
                username: profile.username,
                is_teacher: profile.is_teacher,
                current_unit: profile.current_unit,
                current_lesson: profile.current_lesson,
                avatar_config: profile.avatar_config,
                updated_at: profile.updated_at
            }
        });

    } catch (error) {
        throw handleSupabaseError(error) || error;
    }
});

/**
 * Create a new class section (teacher only)
 * POST /api/classes
 */
export const createClassSection = asyncHandler(async (req, res) => {
    if (!req.user.is_teacher) {
        throw new AuthorizationError('Only teachers can create class sections');
    }

    const { section_name, section_code, settings } = req.body;

    // Validate section code format
    const codePattern = /^[A-Z0-9]{4,20}$/;
    if (!codePattern.test(section_code)) {
        throw new ValidationError('Invalid section code format', [{
            field: 'section_code',
            message: 'Section code must be 4-20 uppercase letters and numbers'
        }]);
    }

    try {
        // Create class section
        const { data: classSection, error } = await supabase
            .from('class_sections')
            .insert({
                section_name: section_name,
                section_code: section_code,
                teacher_username: req.user.username,
                settings: settings || {}
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new ConflictError('Section code already exists', 'class_section');
            }
            throw handleSupabaseError(error);
        }

        res.status(201).json({
            success: true,
            class_section: {
                id: classSection.id,
                section_name: classSection.section_name,
                section_code: classSection.section_code,
                teacher_username: classSection.teacher_username,
                student_count: classSection.student_count || 0,
                settings: classSection.settings,
                created_at: classSection.created_at
            }
        });

    } catch (error) {
        throw handleSupabaseError(error) || error;
    }
});

/**
 * Get class section details
 * GET /api/classes/:section_code
 */
export const getClassSection = asyncHandler(async (req, res) => {
    const { section_code } = req.params;

    try {
        // Get class section with student count
        const { data: classSection, error } = await supabase
            .from('class_sections')
            .select(`
                *,
                profiles!class_section_id (
                    username
                )
            `)
            .eq('section_code', section_code)
            .single();

        if (error || !classSection) {
            throw new NotFoundError('Class section', section_code);
        }

        // Check if user is teacher or member
        const isTeacher = req.user?.is_teacher &&
                         req.user?.username === classSection.teacher_username;
        const isMember = classSection.profiles?.some(p =>
                        p.username === req.user?.username);

        // Build response based on permissions
        const response = {
            id: classSection.id,
            section_name: classSection.section_name,
            section_code: classSection.section_code,
            student_count: classSection.profiles?.length || 0,
            created_at: classSection.created_at
        };

        // Add sensitive info for teacher or members
        if (isTeacher || isMember) {
            response.teacher_username = classSection.teacher_username;
            response.settings = classSection.settings;

            if (isTeacher) {
                // Teacher can see student list
                response.students = classSection.profiles?.map(p => p.username) || [];
            }
        }

        res.json(response);

    } catch (error) {
        throw handleSupabaseError(error) || error;
    }
});

/**
 * Join a class section
 * POST /api/classes/:section_code/join
 */
export const joinClassSection = asyncHandler(async (req, res) => {
    const { section_code } = req.params;
    const username = req.user.username;

    try {
        // Get class section
        const { data: classSection, error: sectionError } = await supabase
            .from('class_sections')
            .select('id')
            .eq('section_code', section_code)
            .single();

        if (sectionError || !classSection) {
            throw new NotFoundError('Class section', section_code);
        }

        // Update profile with class section
        const { data: profile, error: updateError } = await supabase
            .from('profiles')
            .update({
                class_section_id: classSection.id
            })
            .eq('username', username)
            .select()
            .single();

        if (updateError) {
            throw handleSupabaseError(updateError);
        }

        res.json({
            success: true,
            message: 'Successfully joined class section',
            class_section_id: classSection.id
        });

    } catch (error) {
        throw handleSupabaseError(error) || error;
    }
});

/**
 * Leave a class section
 * POST /api/classes/:section_code/leave
 */
export const leaveClassSection = asyncHandler(async (req, res) => {
    const username = req.user.username;

    try {
        // Remove class section from profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .update({
                class_section_id: null
            })
            .eq('username', username)
            .select()
            .single();

        if (error) {
            throw handleSupabaseError(error);
        }

        res.json({
            success: true,
            message: 'Successfully left class section'
        });

    } catch (error) {
        throw handleSupabaseError(error) || error;
    }
});

/**
 * Get class roster (teacher only)
 * GET /api/classes/:section_code/roster
 */
export const getClassRoster = asyncHandler(async (req, res) => {
    const { section_code } = req.params;

    if (!req.user.is_teacher) {
        throw new AuthorizationError('Only teachers can view class roster');
    }

    try {
        // Get class section and verify teacher
        const { data: classSection, error: sectionError } = await supabase
            .from('class_sections')
            .select('id, teacher_username')
            .eq('section_code', section_code)
            .single();

        if (sectionError || !classSection) {
            throw new NotFoundError('Class section', section_code);
        }

        if (classSection.teacher_username !== req.user.username) {
            throw new AuthorizationError('You can only view roster for your own classes');
        }

        // Get all students in class with their progress
        const { data: students, error: studentError } = await supabase
            .from('profiles')
            .select(`
                username,
                is_teacher,
                current_unit,
                current_lesson,
                total_questions_answered,
                total_votes_received,
                badges_earned,
                created_at,
                progress!progress_username_fkey (
                    unit_id,
                    lesson_id,
                    completion_percentage,
                    last_activity
                )
            `)
            .eq('class_section_id', classSection.id)
            .order('username');

        if (studentError) {
            throw handleSupabaseError(studentError);
        }

        // Calculate summary statistics
        const roster = students.map(student => ({
            username: student.username,
            current_unit: student.current_unit,
            current_lesson: student.current_lesson,
            total_questions_answered: student.total_questions_answered,
            badges_earned: student.badges_earned,
            units_completed: student.progress?.filter(p => p.completion_percentage === 100).length || 0,
            last_active: student.progress?.reduce((latest, p) =>
                p.last_activity > latest ? p.last_activity : latest, '') || null,
            joined_date: student.created_at
        }));

        res.json({
            section_code: section_code,
            student_count: roster.length,
            roster: roster
        });

    } catch (error) {
        throw handleSupabaseError(error) || error;
    }
});

export default {
    createProfile,
    getProfile,
    updateProfile,
    createClassSection,
    getClassSection,
    joinClassSection,
    leaveClassSection,
    getClassRoster
};