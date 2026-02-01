\# Agent 2.1: Lead Interactions \& Activity Timeline



\## Project Context

\- \*\*Project Name\*\*: Uppal CRM2

\- \*\*Architecture\*\*: Two-tier multi-tenant CRM

\- \*\*Backend\*\*: Node.js + Express.js (Port 3000)

\- \*\*Frontend\*\*: React + Vite (Port 3002)

\- \*\*Database\*\*: PostgreSQL with RLS



\## What Already Exists ✅

\- ✅ Leads table with CRUD operations

\- ✅ LeadsPage.jsx with table view

\- ✅ `lead\_interactions` table in database (from comprehensive-leads-migration.sql)

\- ✅ Authentication and multi-tenant security

\- ✅ \*\*Server-side search with client-side debouncing\*\* (Jan 30, 2026)



\## Your Mission 🎯

Build a \*\*complete Lead Interactions system\*\* that allows users to:

1\. Log phone calls with leads

2\. Log emails sent/received

3\. Schedule meetings

4\. Add notes to leads

5\. Create follow-up tasks

6\. View activity timeline for each lead

7\. Edit/delete interactions



---



\## Search Implementation in Leads (Jan 30, 2026)



\*\*Frontend\*\* (`frontend/src/pages/Leads.jsx`):

\`\`\`javascript

import { useDebouncedValue } from '../hooks/useDebouncedValue';



\// Add debounced search hook (300ms delay)

const [searchTerm, setSearchTerm] = useState('');

const debouncedSearch = useDebouncedValue(searchTerm, 300);



\// Use debouncedSearch in query parameters

const fetchLeads = useCallback(async (page = 1) => {

  const response = await leadsAPI.getLeads({

    search: debouncedSearch,

    page,

    limit: 20,

    t: Date.now() \// Cache-busting timestamp

  });

  \// ...

}, [debouncedSearch]);

\`\`\`



\*\*Backend\*\* (`routes/leads.js`):

\`\`\`javascript

\// Extract search parameter from query

const { search, status, limit, offset } = req.query;



\// Add ILIKE filtering for case-insensitive search

if (search \&\& search.trim()) {

  query += \` AND (

    l.first_name ILIKE $\${params.length + 1} OR

    l.last_name ILIKE $\${params.length + 1} OR

    l.email ILIKE $\${params.length + 1} OR

    l.company ILIKE $\${params.length + 1}

  )\`;

  params.push(\`%\${search}%\`);

}

\`\`\`



\*\*Search Fields:\*\*

\- First name

\- Last name

\- Email

\- Company



\*\*Key Features:\*\*

\- \*\*300ms debounce delay\*\* - Prevents excessive API calls during typing

\- \*\*Case-insensitive matching\*\* - Uses PostgreSQL \`ILIKE\` operator

\- \*\*Multi-field search\*\* - Searches across 4 different fields

\- \*\*Cache-busting\*\* - Includes timestamp parameter to bypass HTTP caching



---



\## Phase 1: Backend API Routes



\### File: `routes/leadInteractions.js` (NEW FILE)



Create this new file:



```javascript

const express = require('express');

const router = express.Router();

const { authenticateToken } = require('../middleware/auth');

const db = require('../database/db');

const Joi = require('joi');



// Validation schema

const interactionSchema = Joi.object({

&nbsp; interaction\_type: Joi.string().valid('call', 'email', 'meeting', 'note', 'task').required(),

&nbsp; subject: Joi.string().max(255).optional().allow(''),

&nbsp; description: Joi.string().required(),

&nbsp; outcome: Joi.string().max(100).optional().allow(''),

&nbsp; scheduled\_at: Joi.date().iso().optional().allow(null, ''),

&nbsp; duration\_minutes: Joi.number().integer().min(0).optional().allow(null, '')

});



/\*\*

&nbsp;\* GET /api/leads/:leadId/interactions

&nbsp;\* Get all interactions for a specific lead

&nbsp;\*/

router.get('/:leadId/interactions', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { leadId } = req.params;

&nbsp;   const organizationId = req.user.organizationId;



&nbsp;   // Verify lead belongs to organization

&nbsp;   const leadCheck = await db.query(

&nbsp;     'SELECT id FROM leads WHERE id = $1 AND organization\_id = $2',

&nbsp;     \[leadId, organizationId]

&nbsp;   );



&nbsp;   if (leadCheck.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Lead not found' });

&nbsp;   }



&nbsp;   // Get all interactions for this lead

&nbsp;   const query = `

&nbsp;     SELECT 

&nbsp;       li.\*,

&nbsp;       u.first\_name as user\_first\_name,

&nbsp;       u.last\_name as user\_last\_name,

&nbsp;       u.email as user\_email

&nbsp;     FROM lead\_interactions li

&nbsp;     LEFT JOIN users u ON li.user\_id = u.id

&nbsp;     WHERE li.lead\_id = $1

&nbsp;     ORDER BY 

&nbsp;       CASE 

&nbsp;         WHEN li.status = 'scheduled' THEN li.scheduled\_at

&nbsp;         ELSE li.created\_at

&nbsp;       END DESC

&nbsp;   `;



&nbsp;   const result = await db.query(query, \[leadId]);



&nbsp;   res.json({ interactions: result.rows });

&nbsp; } catch (error) {

&nbsp;   console.error('Error fetching interactions:', error);

&nbsp;   res.status(500).json({ error: 'Failed to fetch interactions' });

&nbsp; }

});



/\*\*

&nbsp;\* POST /api/leads/:leadId/interactions

&nbsp;\* Create new interaction for a lead

&nbsp;\*/

router.post('/:leadId/interactions', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { error } = interactionSchema.validate(req.body);

&nbsp;   if (error) {

&nbsp;     return res.status(400).json({ error: error.details\[0].message });

&nbsp;   }



&nbsp;   const { leadId } = req.params;

&nbsp;   const organizationId = req.user.organizationId;

&nbsp;   const userId = req.user.userId;



&nbsp;   // Verify lead belongs to organization

&nbsp;   const leadCheck = await db.query(

&nbsp;     'SELECT id FROM leads WHERE id = $1 AND organization\_id = $2',

&nbsp;     \[leadId, organizationId]

&nbsp;   );



&nbsp;   if (leadCheck.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Lead not found' });

&nbsp;   }



&nbsp;   const {

&nbsp;     interaction\_type,

&nbsp;     subject,

&nbsp;     description,

&nbsp;     outcome,

&nbsp;     scheduled\_at,

&nbsp;     duration\_minutes

&nbsp;   } = req.body;



&nbsp;   // Determine status based on whether it's scheduled for future

&nbsp;   const status = scheduled\_at \&\& new Date(scheduled\_at) > new Date() 

&nbsp;     ? 'scheduled' 

&nbsp;     : 'completed';

&nbsp;   

&nbsp;   const completed\_at = status === 'completed' ? new Date() : null;



&nbsp;   // Insert interaction

&nbsp;   const insertQuery = `

&nbsp;     INSERT INTO lead\_interactions (

&nbsp;       lead\_id, user\_id, interaction\_type, subject, description,

&nbsp;       outcome, scheduled\_at, completed\_at, duration\_minutes, status

&nbsp;     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)

&nbsp;     RETURNING \*

&nbsp;   `;



&nbsp;   const result = await db.query(insertQuery, \[

&nbsp;     leadId,

&nbsp;     userId,

&nbsp;     interaction\_type,

&nbsp;     subject || null,

&nbsp;     description,

&nbsp;     outcome || null,

&nbsp;     scheduled\_at || null,

&nbsp;     completed\_at,

&nbsp;     duration\_minutes || null,

&nbsp;     status

&nbsp;   ]);



&nbsp;   // Update lead's last\_contact\_date if interaction is completed

&nbsp;   if (status === 'completed') {

&nbsp;     await db.query(

&nbsp;       'UPDATE leads SET last\_contact\_date = NOW(), updated\_at = NOW() WHERE id = $1',

&nbsp;       \[leadId]

&nbsp;     );

&nbsp;   }



&nbsp;   res.status(201).json({

&nbsp;     message: 'Interaction created successfully',

&nbsp;     interaction: result.rows\[0]

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error creating interaction:', error);

&nbsp;   res.status(500).json({ error: 'Failed to create interaction' });

&nbsp; }

});



/\*\*

&nbsp;\* PUT /api/leads/:leadId/interactions/:interactionId

&nbsp;\* Update an existing interaction

&nbsp;\*/

router.put('/:leadId/interactions/:interactionId', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { leadId, interactionId } = req.params;

&nbsp;   const organizationId = req.user.organizationId;



&nbsp;   // Verify lead belongs to organization

&nbsp;   const leadCheck = await db.query(

&nbsp;     'SELECT id FROM leads WHERE id = $1 AND organization\_id = $2',

&nbsp;     \[leadId, organizationId]

&nbsp;   );



&nbsp;   if (leadCheck.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Lead not found' });

&nbsp;   }



&nbsp;   const {

&nbsp;     interaction\_type,

&nbsp;     subject,

&nbsp;     description,

&nbsp;     outcome,

&nbsp;     scheduled\_at,

&nbsp;     duration\_minutes,

&nbsp;     status

&nbsp;   } = req.body;



&nbsp;   // Update interaction

&nbsp;   const query = `

&nbsp;     UPDATE lead\_interactions

&nbsp;     SET 

&nbsp;       interaction\_type = COALESCE($1, interaction\_type),

&nbsp;       subject = COALESCE($2, subject),

&nbsp;       description = COALESCE($3, description),

&nbsp;       outcome = COALESCE($4, outcome),

&nbsp;       scheduled\_at = COALESCE($5, scheduled\_at),

&nbsp;       duration\_minutes = COALESCE($6, duration\_minutes),

&nbsp;       status = COALESCE($7, status),

&nbsp;       completed\_at = CASE 

&nbsp;         WHEN COALESCE($7, status) = 'completed' AND completed\_at IS NULL 

&nbsp;         THEN NOW() 

&nbsp;         ELSE completed\_at 

&nbsp;       END,

&nbsp;       updated\_at = NOW()

&nbsp;     WHERE id = $8 AND lead\_id = $9

&nbsp;     RETURNING \*

&nbsp;   `;



&nbsp;   const result = await db.query(query, \[

&nbsp;     interaction\_type,

&nbsp;     subject,

&nbsp;     description,

&nbsp;     outcome,

&nbsp;     scheduled\_at,

&nbsp;     duration\_minutes,

&nbsp;     status,

&nbsp;     interactionId,

&nbsp;     leadId

&nbsp;   ]);



&nbsp;   if (result.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Interaction not found' });

&nbsp;   }



&nbsp;   res.json({

&nbsp;     message: 'Interaction updated successfully',

&nbsp;     interaction: result.rows\[0]

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error updating interaction:', error);

&nbsp;   res.status(500).json({ error: 'Failed to update interaction' });

&nbsp; }

});



/\*\*

&nbsp;\* DELETE /api/leads/:leadId/interactions/:interactionId

&nbsp;\* Delete an interaction

&nbsp;\*/

router.delete('/:leadId/interactions/:interactionId', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { leadId, interactionId } = req.params;

&nbsp;   const organizationId = req.user.organizationId;



&nbsp;   // Verify lead belongs to organization

&nbsp;   const leadCheck = await db.query(

&nbsp;     'SELECT id FROM leads WHERE id = $1 AND organization\_id = $2',

&nbsp;     \[leadId, organizationId]

&nbsp;   );



&nbsp;   if (leadCheck.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Lead not found' });

&nbsp;   }



&nbsp;   // Delete interaction

&nbsp;   const query = `

&nbsp;     DELETE FROM lead\_interactions

&nbsp;     WHERE id = $1 AND lead\_id = $2

&nbsp;     RETURNING id

&nbsp;   `;



&nbsp;   const result = await db.query(query, \[interactionId, leadId]);



&nbsp;   if (result.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Interaction not found' });

&nbsp;   }



&nbsp;   res.json({ message: 'Interaction deleted successfully' });

&nbsp; } catch (error) {

&nbsp;   console.error('Error deleting interaction:', error);

&nbsp;   res.status(500).json({ error: 'Failed to delete interaction' });

&nbsp; }

});



/\*\*

&nbsp;\* PATCH /api/leads/:leadId/interactions/:interactionId/complete

&nbsp;\* Mark a scheduled interaction as completed

&nbsp;\*/

router.patch('/:leadId/interactions/:interactionId/complete', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { leadId, interactionId } = req.params;

&nbsp;   const { outcome, duration\_minutes } = req.body;

&nbsp;   const organizationId = req.user.organizationId;



&nbsp;   // Verify lead belongs to organization

&nbsp;   const leadCheck = await db.query(

&nbsp;     'SELECT id FROM leads WHERE id = $1 AND organization\_id = $2',

&nbsp;     \[leadId, organizationId]

&nbsp;   );



&nbsp;   if (leadCheck.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Lead not found' });

&nbsp;   }



&nbsp;   // Mark as completed

&nbsp;   const query = `

&nbsp;     UPDATE lead\_interactions

&nbsp;     SET 

&nbsp;       status = 'completed',

&nbsp;       completed\_at = NOW(),

&nbsp;       outcome = COALESCE($1, outcome),

&nbsp;       duration\_minutes = COALESCE($2, duration\_minutes),

&nbsp;       updated\_at = NOW()

&nbsp;     WHERE id = $3 AND lead\_id = $4

&nbsp;     RETURNING \*

&nbsp;   `;



&nbsp;   const result = await db.query(query, \[outcome, duration\_minutes, interactionId, leadId]);



&nbsp;   if (result.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Interaction not found' });

&nbsp;   }



&nbsp;   // Update lead's last\_contact\_date

&nbsp;   await db.query(

&nbsp;     'UPDATE leads SET last\_contact\_date = NOW(), updated\_at = NOW() WHERE id = $1',

&nbsp;     \[leadId]

&nbsp;   );



&nbsp;   res.json({

&nbsp;     message: 'Interaction marked as completed',

&nbsp;     interaction: result.rows\[0]

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error completing interaction:', error);

&nbsp;   res.status(500).json({ error: 'Failed to complete interaction' });

&nbsp; }

});



module.exports = router;

```



---



\### File: `server.js` (UPDATE EXISTING)



Add this route to your server.js (find where other routes are defined and add this):



```javascript

const leadInteractionsRoutes = require('./routes/leadInteractions');



// Add with your other routes (around line where you have app.use('/api/leads', ...))

app.use('/api/leads', leadInteractionsRoutes);

```



---



\## Phase 2: Frontend Components



\### File: `frontend/src/components/AddInteractionModal.jsx` (NEW FILE)



```jsx

import React, { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { X, Phone, Mail, Calendar, FileText, CheckSquare } from 'lucide-react';

import { leadInteractionsAPI } from '../services/api';



const INTERACTION\_TYPES = \[

&nbsp; { value: 'call', label: 'Phone Call', icon: Phone },

&nbsp; { value: 'email', label: 'Email', icon: Mail },

&nbsp; { value: 'meeting', label: 'Meeting', icon: Calendar },

&nbsp; { value: 'note', label: 'Note', icon: FileText },

&nbsp; { value: 'task', label: 'Task', icon: CheckSquare }

];



const OUTCOMES = \[

&nbsp; 'Successful',

&nbsp; 'No Answer',

&nbsp; 'Voicemail Left',

&nbsp; 'Callback Requested',

&nbsp; 'Meeting Scheduled',

&nbsp; 'Not Interested',

&nbsp; 'Follow Up Required',

&nbsp; 'Information Sent'

];



const AddInteractionModal = ({ leadId, onClose, onSuccess }) => {

&nbsp; const \[formData, setFormData] = useState({

&nbsp;   interaction\_type: 'call',

&nbsp;   subject: '',

&nbsp;   description: '',

&nbsp;   outcome: '',

&nbsp;   scheduled\_at: '',

&nbsp;   duration\_minutes: ''

&nbsp; });

&nbsp; 

&nbsp; const queryClient = useQueryClient();



&nbsp; const createMutation = useMutation({

&nbsp;   mutationFn: () => leadInteractionsAPI.createInteraction(leadId, formData),

&nbsp;   onSuccess: () => {

&nbsp;     queryClient.invalidateQueries(\['leadInteractions', leadId]);

&nbsp;     queryClient.invalidateQueries(\['leads']);

&nbsp;     onSuccess?.();

&nbsp;     onClose();

&nbsp;   }

&nbsp; });



&nbsp; const handleSubmit = (e) => {

&nbsp;   e.preventDefault();

&nbsp;   createMutation.mutate();

&nbsp; };



&nbsp; const selectedType = INTERACTION\_TYPES.find(t => t.value === formData.interaction\_type);

&nbsp; const IconComponent = selectedType?.icon;



&nbsp; return (

&nbsp;   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

&nbsp;     <div className="bg-white rounded-lg max-w-2xl w-full max-h-\[90vh] overflow-y-auto">

&nbsp;       {/\* Header \*/}

&nbsp;       <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">

&nbsp;         <div className="flex items-center gap-3">

&nbsp;           {IconComponent \&\& <IconComponent className="w-6 h-6 text-blue-600" />}

&nbsp;           <h2 className="text-xl font-semibold text-gray-900">Log Interaction</h2>

&nbsp;         </div>

&nbsp;         <button onClick={onClose} className="text-gray-400 hover:text-gray-600">

&nbsp;           <X className="w-6 h-6" />

&nbsp;         </button>

&nbsp;       </div>



&nbsp;       {/\* Form \*/}

&nbsp;       <form onSubmit={handleSubmit} className="p-6 space-y-5">

&nbsp;         {/\* Interaction Type \*/}

&nbsp;         <div>

&nbsp;           <label className="block text-sm font-medium text-gray-700 mb-3">

&nbsp;             Type \*

&nbsp;           </label>

&nbsp;           <div className="grid grid-cols-5 gap-2">

&nbsp;             {INTERACTION\_TYPES.map(type => {

&nbsp;               const Icon = type.icon;

&nbsp;               return (

&nbsp;                 <button

&nbsp;                   key={type.value}

&nbsp;                   type="button"

&nbsp;                   onClick={() => setFormData({ ...formData, interaction\_type: type.value })}

&nbsp;                   className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${

&nbsp;                     formData.interaction\_type === type.value

&nbsp;                       ? 'border-blue-600 bg-blue-50 text-blue-700'

&nbsp;                       : 'border-gray-200 hover:border-gray-300 text-gray-600'

&nbsp;                   }`}

&nbsp;                 >

&nbsp;                   <Icon className="w-5 h-5" />

&nbsp;                   <span className="text-xs font-medium">{type.label}</span>

&nbsp;                 </button>

&nbsp;               );

&nbsp;             })}

&nbsp;           </div>

&nbsp;         </div>



&nbsp;         {/\* Subject \*/}

&nbsp;         <div>

&nbsp;           <label className="block text-sm font-medium text-gray-700 mb-2">

&nbsp;             Subject

&nbsp;           </label>

&nbsp;           <input

&nbsp;             type="text"

&nbsp;             value={formData.subject}

&nbsp;             onChange={(e) => setFormData({ ...formData, subject: e.target.value })}

&nbsp;             placeholder="Brief summary (optional)..."

&nbsp;             className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

&nbsp;           />

&nbsp;         </div>



&nbsp;         {/\* Description \*/}

&nbsp;         <div>

&nbsp;           <label className="block text-sm font-medium text-gray-700 mb-2">

&nbsp;             Description \*

&nbsp;           </label>

&nbsp;           <textarea

&nbsp;             value={formData.description}

&nbsp;             onChange={(e) => setFormData({ ...formData, description: e.target.value })}

&nbsp;             placeholder="Detailed notes about this interaction..."

&nbsp;             rows="5"

&nbsp;             className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"

&nbsp;             required

&nbsp;           />

&nbsp;           <p className="text-xs text-gray-500 mt-1">

&nbsp;             {formData.description.length} characters

&nbsp;           </p>

&nbsp;         </div>



&nbsp;         {/\* Outcome (for calls, emails, meetings) \*/}

&nbsp;         {\['call', 'email', 'meeting'].includes(formData.interaction\_type) \&\& (

&nbsp;           <div>

&nbsp;             <label className="block text-sm font-medium text-gray-700 mb-2">

&nbsp;               Outcome

&nbsp;             </label>

&nbsp;             <select

&nbsp;               value={formData.outcome}

&nbsp;               onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}

&nbsp;               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

&nbsp;             >

&nbsp;               <option value="">Select outcome...</option>

&nbsp;               {OUTCOMES.map(outcome => (

&nbsp;                 <option key={outcome} value={outcome}>{outcome}</option>

&nbsp;               ))}

&nbsp;             </select>

&nbsp;           </div>

&nbsp;         )}



&nbsp;         {/\* Duration (for calls and meetings) \*/}

&nbsp;         {\['call', 'meeting'].includes(formData.interaction\_type) \&\& (

&nbsp;           <div>

&nbsp;             <label className="block text-sm font-medium text-gray-700 mb-2">

&nbsp;               Duration (minutes)

&nbsp;             </label>

&nbsp;             <input

&nbsp;               type="number"

&nbsp;               value={formData.duration\_minutes}

&nbsp;               onChange={(e) => setFormData({ ...formData, duration\_minutes: e.target.value })}

&nbsp;               min="0"

&nbsp;               placeholder="15"

&nbsp;               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

&nbsp;             />

&nbsp;           </div>

&nbsp;         )}



&nbsp;         {/\* Scheduled Date/Time (for tasks and meetings) \*/}

&nbsp;         {\['task', 'meeting'].includes(formData.interaction\_type) \&\& (

&nbsp;           <div>

&nbsp;             <label className="block text-sm font-medium text-gray-700 mb-2">

&nbsp;               {formData.interaction\_type === 'task' ? 'Schedule For' : 'Meeting Date/Time'}

&nbsp;             </label>

&nbsp;             <input

&nbsp;               type="datetime-local"

&nbsp;               value={formData.scheduled\_at}

&nbsp;               onChange={(e) => setFormData({ ...formData, scheduled\_at: e.target.value })}

&nbsp;               className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

&nbsp;             />

&nbsp;             <p className="text-xs text-gray-500 mt-1">

&nbsp;               Leave empty to mark as completed now

&nbsp;             </p>

&nbsp;           </div>

&nbsp;         )}



&nbsp;         {/\* Error Message \*/}

&nbsp;         {createMutation.isError \&\& (

&nbsp;           <div className="p-4 bg-red-50 border border-red-200 rounded-lg">

&nbsp;             <p className="text-sm text-red-600">

&nbsp;               {createMutation.error?.response?.data?.error || 'Failed to create interaction'}

&nbsp;             </p>

&nbsp;           </div>

&nbsp;         )}



&nbsp;         {/\* Actions \*/}

&nbsp;         <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">

&nbsp;           <button

&nbsp;             type="button"

&nbsp;             onClick={onClose}

&nbsp;             className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"

&nbsp;           >

&nbsp;             Cancel

&nbsp;           </button>

&nbsp;           <button

&nbsp;             type="submit"

&nbsp;             disabled={createMutation.isPending || !formData.description}

&nbsp;             className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"

&nbsp;           >

&nbsp;             {createMutation.isPending ? (

&nbsp;               <>

&nbsp;                 <span className="inline-block animate-spin mr-2">⏳</span>

&nbsp;                 Saving...

&nbsp;               </>

&nbsp;             ) : (

&nbsp;               'Save Interaction'

&nbsp;             )}

&nbsp;           </button>

&nbsp;         </div>

&nbsp;       </form>

&nbsp;     </div>

&nbsp;   </div>

&nbsp; );

};



export default AddInteractionModal;

```



---



\### File: `frontend/src/components/InteractionsTimeline.jsx` (NEW FILE)



```jsx

import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { 

&nbsp; Phone, Mail, Calendar, FileText, CheckSquare, Clock,

&nbsp; CheckCircle, MoreVertical, Edit2, Trash2, Plus

} from 'lucide-react';

import { leadInteractionsAPI } from '../services/api';

import { format, formatDistanceToNow } from 'date-fns';

import LoadingSpinner from './LoadingSpinner';

import AddInteractionModal from './AddInteractionModal';



const INTERACTION\_ICONS = {

&nbsp; call: Phone,

&nbsp; email: Mail,

&nbsp; meeting: Calendar,

&nbsp; note: FileText,

&nbsp; task: CheckSquare

};



const INTERACTION\_COLORS = {

&nbsp; call: 'text-green-600 bg-green-100',

&nbsp; email: 'text-blue-600 bg-blue-100',

&nbsp; meeting: 'text-purple-600 bg-purple-100',

&nbsp; note: 'text-gray-600 bg-gray-100',

&nbsp; task: 'text-orange-600 bg-orange-100'

};



const InteractionsTimeline = ({ leadId }) => {

&nbsp; const \[showAddModal, setShowAddModal] = useState(false);

&nbsp; const \[selectedInteraction, setSelectedInteraction] = useState(null);

&nbsp; const queryClient = useQueryClient();



&nbsp; // Fetch interactions

&nbsp; const { data, isLoading } = useQuery({

&nbsp;   queryKey: \['leadInteractions', leadId],

&nbsp;   queryFn: () => leadInteractionsAPI.getInteractions(leadId)

&nbsp; });



&nbsp; // Delete mutation

&nbsp; const deleteMutation = useMutation({

&nbsp;   mutationFn: (interactionId) => 

&nbsp;     leadInteractionsAPI.deleteInteraction(leadId, interactionId),

&nbsp;   onSuccess: () => {

&nbsp;     queryClient.invalidateQueries(\['leadInteractions', leadId]);

&nbsp;     queryClient.invalidateQueries(\['leads']);

&nbsp;   }

&nbsp; });



&nbsp; // Complete task mutation

&nbsp; const completeMutation = useMutation({

&nbsp;   mutationFn: ({ interactionId, outcome, duration }) =>

&nbsp;     leadInteractionsAPI.completeInteraction(leadId, interactionId, { outcome, duration\_minutes: duration }),

&nbsp;   onSuccess: () => {

&nbsp;     queryClient.invalidateQueries(\['leadInteractions', leadId]);

&nbsp;   }

&nbsp; });



&nbsp; const handleDelete = (interactionId) => {

&nbsp;   if (window.confirm('Are you sure you want to delete this interaction?')) {

&nbsp;     deleteMutation.mutate(interactionId);

&nbsp;   }

&nbsp; };



&nbsp; const handleComplete = (interaction) => {

&nbsp;   const outcome = prompt('Outcome (optional):');

&nbsp;   const duration = interaction.interaction\_type === 'call' || interaction.interaction\_type === 'meeting'

&nbsp;     ? prompt('Duration in minutes:')

&nbsp;     : null;

&nbsp;   

&nbsp;   completeMutation.mutate({

&nbsp;     interactionId: interaction.id,

&nbsp;     outcome,

&nbsp;     duration: duration ? parseInt(duration) : null

&nbsp;   });

&nbsp; };



&nbsp; if (isLoading) {

&nbsp;   return <LoadingSpinner />;

&nbsp; }



&nbsp; const interactions = data?.interactions || \[];



&nbsp; return (

&nbsp;   <div className="space-y-4">

&nbsp;     {/\* Header \*/}

&nbsp;     <div className="flex items-center justify-between">

&nbsp;       <h3 className="text-lg font-semibold text-gray-900">

&nbsp;         Activity Timeline ({interactions.length})

&nbsp;       </h3>

&nbsp;       <button

&nbsp;         onClick={() => setShowAddModal(true)}

&nbsp;         className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"

&nbsp;       >

&nbsp;         <Plus className="w-4 h-4" />

&nbsp;         Add Interaction

&nbsp;       </button>

&nbsp;     </div>



&nbsp;     {/\* Timeline \*/}

&nbsp;     {interactions.length === 0 ? (

&nbsp;       <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">

&nbsp;         <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />

&nbsp;         <p className="text-gray-600 font-medium">No interactions yet</p>

&nbsp;         <p className="text-sm text-gray-500 mt-1">Start logging calls, emails, and meetings</p>

&nbsp;         <button

&nbsp;           onClick={() => setShowAddModal(true)}

&nbsp;           className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"

&nbsp;         >

&nbsp;           Add First Interaction

&nbsp;         </button>

&nbsp;       </div>

&nbsp;     ) : (

&nbsp;       <div className="space-y-3">

&nbsp;         {interactions.map((interaction, index) => {

&nbsp;           const Icon = INTERACTION\_ICONS\[interaction.interaction\_type];

&nbsp;           const colorClass = INTERACTION\_COLORS\[interaction.interaction\_type];

&nbsp;           const isScheduled = interaction.status === 'scheduled';

&nbsp;           const isOverdue = isScheduled \&\& new Date(interaction.scheduled\_at) < new Date();



&nbsp;           return (

&nbsp;             <div

&nbsp;               key={interaction.id}

&nbsp;               className={`relative pl-8 pb-3 ${

&nbsp;                 index !== interactions.length - 1 ? 'border-l-2 border-gray-200 ml-4' : ''

&nbsp;               }`}

&nbsp;             >

&nbsp;               {/\* Icon \*/}

&nbsp;               <div className={`absolute left-0 top-0 -ml-\[1.125rem] w-9 h-9 rounded-full flex items-center justify-center ${colorClass}`}>

&nbsp;                 <Icon className="w-4 h-4" />

&nbsp;               </div>



&nbsp;               {/\* Content \*/}

&nbsp;               <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">

&nbsp;                 <div className="flex items-start justify-between">

&nbsp;                   <div className="flex-1">

&nbsp;                     {/\* Header \*/}

&nbsp;                     <div className="flex items-center gap-2 mb-1">

&nbsp;                       <span className="font-medium text-gray-900 capitalize">

&nbsp;                         {interaction.interaction\_type}

&nbsp;                       </span>

&nbsp;                       {interaction.subject \&\& (

&nbsp;                         <>

&nbsp;                           <span className="text-gray-400">•</span>

&nbsp;                           <span className="text-gray-700">{interaction.subject}</span>

&nbsp;                         </>

&nbsp;                       )}

&nbsp;                       {isScheduled \&\& (

&nbsp;                         <span className={`px-2 py-1 rounded-full text-xs font-medium ${

&nbsp;                           isOverdue 

&nbsp;                             ? 'bg-red-100 text-red-700' 

&nbsp;                             : 'bg-yellow-100 text-yellow-700'

&nbsp;                         }`}>

&nbsp;                           {isOverdue ? 'Overdue' : 'Scheduled'}

&nbsp;                         </span>

&nbsp;                       )}

&nbsp;                     </div>



&nbsp;                     {/\* Description \*/}

&nbsp;                     <p className="text-gray-700 text-sm mb-2 whitespace-pre-wrap">

&nbsp;                       {interaction.description}

&nbsp;                     </p>



&nbsp;                     {/\* Metadata \*/}

&nbsp;                     <div className="flex items-center gap-4 text-xs text-gray-500">

&nbsp;                       <div className="flex items-center gap-1">

&nbsp;                         <Clock className="w-3 h-3" />

&nbsp;                         {isScheduled ? (

&nbsp;                           <span>

&nbsp;                             Scheduled for {format(new Date(interaction.scheduled\_at), 'MMM d, yyyy h:mm a')}

&nbsp;                           </span>

&nbsp;                         ) : (

&nbsp;                           <span>

&nbsp;                             {formatDistanceToNow(new Date(interaction.created\_at), { addSuffix: true })}

&nbsp;                           </span>

&nbsp;                         )}

&nbsp;                       </div>

&nbsp;                       

&nbsp;                       {interaction.outcome \&\& (

&nbsp;                         <>

&nbsp;                           <span>•</span>

&nbsp;                           <span>Outcome: {interaction.outcome}</span>

&nbsp;                         </>

&nbsp;                       )}

&nbsp;                       

&nbsp;                       {interaction.duration\_minutes \&\& (

&nbsp;                         <>

&nbsp;                           <span>•</span>

&nbsp;                           <span>{interaction.duration\_minutes} minutes</span>

&nbsp;                         </>

&nbsp;                       )}

&nbsp;                       

&nbsp;                       {interaction.user\_first\_name \&\& (

&nbsp;                         <>

&nbsp;                           <span>•</span>

&nbsp;                           <span>by {interaction.user\_first\_name} {interaction.user\_last\_name}</span>

&nbsp;                         </>

&nbsp;                       )}

&nbsp;                     </div>

&nbsp;                   </div>



&nbsp;                   {/\* Actions \*/}

&nbsp;                   <div className="flex items-center gap-2 ml-4">

&nbsp;                     {isScheduled \&\& (

&nbsp;                       <button

&nbsp;                         onClick={() => handleComplete(interaction)}

&nbsp;                         className="p-1 text-green-600 hover:bg-green-50 rounded"

&nbsp;                         title="Mark as completed"

&nbsp;                       >

&nbsp;                         <CheckCircle className="w-4 h-4" />

&nbsp;                       </button>

&nbsp;                     )}

&nbsp;                     <button

&nbsp;                       onClick={() => handleDelete(interaction.id)}

&nbsp;                       className="p-1 text-red-600 hover:bg-red-50 rounded"

&nbsp;                       title="Delete"

&nbsp;                     >

&nbsp;                       <Trash2 className="w-4 h-4" />

&nbsp;                     </button>

&nbsp;                   </div>

&nbsp;                 </div>

&nbsp;               </div>

&nbsp;             </div>

&nbsp;           );

&nbsp;         })}

&nbsp;       </div>

&nbsp;     )}



&nbsp;     {/\* Add Interaction Modal \*/}

&nbsp;     {showAddModal \&\& (

&nbsp;       <AddInteractionModal

&nbsp;         leadId={leadId}

&nbsp;         onClose={() => setShowAddModal(false)}

&nbsp;         onSuccess={() => setShowAddModal(false)}

&nbsp;       />

&nbsp;     )}

&nbsp;   </div>

&nbsp; );

};



export default InteractionsTimeline;

```



---



\### File: `frontend/src/services/api.js` (UPDATE EXISTING)



Add these methods to your existing api.js file:



```javascript

// Lead Interactions API

export const leadInteractionsAPI = {

&nbsp; getInteractions: async (leadId) => {

&nbsp;   const response = await api.get(`/leads/${leadId}/interactions`);

&nbsp;   return response.data;

&nbsp; },

&nbsp; 

&nbsp; createInteraction: async (leadId, data) => {

&nbsp;   const response = await api.post(`/leads/${leadId}/interactions`, data);

&nbsp;   return response.data;

&nbsp; },

&nbsp; 

&nbsp; updateInteraction: async (leadId, interactionId, data) => {

&nbsp;   const response = await api.put(`/leads/${leadId}/interactions/${interactionId}`, data);

&nbsp;   return response.data;

&nbsp; },

&nbsp; 

&nbsp; deleteInteraction: async (leadId, interactionId) => {

&nbsp;   const response = await api.delete(`/leads/${leadId}/interactions/${interactionId}`);

&nbsp;   return response.data;

&nbsp; },

&nbsp; 

&nbsp; completeInteraction: async (leadId, interactionId, data) => {

&nbsp;   const response = await api.patch(`/leads/${leadId}/interactions/${interactionId}/complete`, data);

&nbsp;   return response.data;

&nbsp; }

};

```



---



\### File: `frontend/src/pages/LeadsPage.jsx` (UPDATE EXISTING)



Add the "Interactions" button to each lead row. Find the actions section in your table row and add:



```jsx

import { MessageSquare } from 'lucide-react';

import InteractionsTimeline from '../components/InteractionsTimeline';



// Add state for showing interactions

const \[showInteractions, setShowInteractions] = useState(null);



// In your table row actions, add this button:

<button

&nbsp; onClick={() => setShowInteractions(lead.id)}

&nbsp; className="text-blue-600 hover:text-blue-800"

&nbsp; title="View Interactions"

>

&nbsp; <MessageSquare className="w-4 h-4" />

</button>



// At the end of your component, before the closing tag:

{showInteractions \&\& (

&nbsp; <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

&nbsp;   <div className="bg-white rounded-lg max-w-4xl w-full max-h-\[90vh] overflow-hidden flex flex-col">

&nbsp;     <div className="flex items-center justify-between p-6 border-b border-gray-200">

&nbsp;       <h2 className="text-xl font-semibold text-gray-900">Lead Interactions</h2>

&nbsp;       <button

&nbsp;         onClick={() => setShowInteractions(null)}

&nbsp;         className="text-gray-400 hover:text-gray-600"

&nbsp;       >

&nbsp;         <X className="w-6 h-6" />

&nbsp;       </button>

&nbsp;     </div>

&nbsp;     <div className="flex-1 overflow-y-auto p-6">

&nbsp;       <InteractionsTimeline leadId={showInteractions} />

&nbsp;     </div>

&nbsp;   </div>

&nbsp; </div>

)}

```



---



\## Phase 3: Install Dependencies



\### File: `frontend/package.json` (Add date-fns if not already installed)



```bash

cd frontend

npm install date-fns

```



---



\## Testing Checklist



After the agent completes, test these features:



\### Basic Functionality

\- \[ ] Click "Interactions" button on a lead - modal opens

\- \[ ] Click "Add Interaction" - modal opens

\- \[ ] Select different interaction types - UI updates correctly

\- \[ ] Fill out form and save - interaction appears in timeline

\- \[ ] View timeline - interactions show in chronological order



\### Call Interaction

\- \[ ] Create call interaction

\- \[ ] Add duration in minutes

\- \[ ] Select outcome from dropdown

\- \[ ] Call appears in timeline with phone icon

\- \[ ] Duration displays correctly



\### Email Interaction

\- \[ ] Create email interaction

\- \[ ] Add subject line

\- \[ ] Email appears with mail icon

\- \[ ] Outcome recorded



\### Meeting Interaction

\- \[ ] Create meeting with future date/time

\- \[ ] Meeting shows as "Scheduled"

\- \[ ] Complete scheduled meeting

\- \[ ] Status changes to "Completed"



\### Task Interaction

\- \[ ] Create task scheduled for tomorrow

\- \[ ] Task shows as "Scheduled"

\- \[ ] Mark task as complete

\- \[ ] Task moves to completed status



\### Note Interaction

\- \[ ] Add simple note to lead

\- \[ ] Note appears immediately in timeline

\- \[ ] Note icon displays



\### Timeline Features

\- \[ ] Interactions sorted correctly (newest first)

\- \[ ] Scheduled items show scheduled date

\- \[ ] Completed items show "X time ago"

\- \[ ] User name displays on each interaction

\- \[ ] Delete interaction removes it from timeline

\- \[ ] Confirm dialog appears before delete



\### Multi-tenant Security

\- \[ ] Create interaction on lead in Org A

\- \[ ] Login to Org B

\- \[ ] Cannot see Org A's interactions

\- \[ ] Can only add interactions to own leads



---



\## Success Criteria



✅ Can log all 5 interaction types (call, email, meeting, note, task)

✅ Timeline displays chronologically

✅ Scheduled interactions show future date

✅ Can mark scheduled items as completed

✅ Can delete interactions with confirmation

✅ Lead's last\_contact\_date updates on completed interactions

✅ Multi-tenant security enforced

✅ UI is responsive and looks good

✅ No console errors

✅ Icons and colors display correctly for each type



---



\## How to Run This Agent



\### Step 1: Save Instructions

```bash

\# Save this document as:

agents/02-1-lead-interactions.md

```



\### Step 2: Run Agent

```bash

\# In your project directory:

claude code "Read the file agents/02-1-lead-interactions.md and implement the complete Lead Interactions system as specified. Build all backend routes, frontend components, and integrate with the existing LeadsPage. Follow all requirements exactly."

```



\### Step 3: Install Dependencies

```bash

cd frontend

npm install date-fns

cd ..

```



\### Step 4: Restart Servers

```bash

\# Terminal 1

npm run dev



\# Terminal 2

cd frontend

npm run dev

```



\### Step 5: Test

1\. Go to http://localhost:3002/leads

2\. Click the message icon on any lead

3\. Click "Add Interaction"

4\. Test all 5 interaction types

5\. Verify timeline displays correctly



---



\## Expected Results



\*\*After this agent completes:\*\*

\- ✅ New "Interactions" button on each lead

\- ✅ Interactions timeline modal

\- ✅ Add interaction modal with 5 types

\- ✅ Beautiful timeline UI with icons

\- ✅ Complete/delete functionality

\- ✅ Scheduled vs completed states

\- ✅ All data properly stored





