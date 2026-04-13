import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Container, Typography, Card, Box, TextField, Button, Stack, Avatar, Paper,
  List, ListItemButton, ListItemText, IconButton, Divider, Backdrop,
} from '@mui/material';
import { Send, SmartToy, Person, Add, Lock } from '@mui/icons-material';

export default function AIChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (user) {
      api.get('/ai/conversations/').then(r => setConversations(r.data.results || r.data || []));
    }
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectConv = (conv) => {
    setActiveConv(conv);
    setMessages(conv.messages || []);
  };

  const newChat = () => {
    setActiveConv(null);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/ai/send/', { message: userMsg.content, conversation_id: activeConv?.id || undefined });
      setActiveConv(res.data.conversation);
      setMessages(res.data.conversation.messages);
      api.get('/ai/conversations/').then(r => setConversations(r.data.results || r.data || []));
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', position: 'relative' }}>

      {/* ===== LOGIN OVERLAY for non-authenticated users ===== */}
      {!user && (
        <Backdrop
          open
          sx={{
            position: 'absolute', zIndex: 10,
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            flexDirection: 'column', gap: 2,
          }}
        >
          <Lock sx={{ fontSize: 56, color: 'white', mb: 1 }} />
          <Typography variant="h3" sx={{ color: 'white', textAlign: 'center' }}>
            Log in to use the AI Assistant
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 400, mb: 2 }}>
            The AI Academic Assistant is available to registered StudySpace users. Sign up for free to get guided academic support.
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" size="large" onClick={() => navigate('/login')}
              sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}>
              Log In
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/signup')}
              sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>
              Sign Up — Free
            </Button>
          </Stack>
        </Backdrop>
      )}

      {/* Sidebar */}
      <Box sx={{ width: 280, borderRight: 1, borderColor: 'divider', display: { xs: 'none', md: 'flex' }, flexDirection: 'column' }}>
        <Box sx={{ p: 2 }}>
          <Button fullWidth variant="contained" startIcon={<Add />} onClick={newChat} disabled={!user}>New Chat</Button>
        </Box>
        <Divider />
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {conversations.map(c => (
            <ListItemButton key={c.id} selected={activeConv?.id === c.id} onClick={() => selectConv(c)}>
              <ListItemText primary={c.title} secondary={new Date(c.updated_at).toLocaleDateString()} primaryTypographyProps={{ noWrap: true, variant: 'body2' }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* Chat area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h4">AI Academic Assistant</Typography>
          <Typography variant="caption" color="text.secondary">Guided support — not direct answers</Typography>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {messages.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <SmartToy sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" sx={{ mb: 1 }}>Welcome to the AI Academic Assistant</Typography>
              <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
                I will guide you through academic questions step by step. I will not give direct answers, but I will help you think through problems yourself.
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ gap: 1 }}>
                {['Help me understand recursion', 'How do I structure an essay?', 'CV tips for graduates'].map(q => (
                  <Button key={q} variant="outlined" size="small" onClick={() => setInput(q)} disabled={!user}>
                    {q}
                  </Button>
                ))}
              </Stack>
            </Box>
          )}

          {messages.map((m, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 2, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role !== 'user' && <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}><SmartToy sx={{ fontSize: 18 }} /></Avatar>}
              <Paper sx={{ p: 2, maxWidth: '70%', bgcolor: m.role === 'user' ? 'primary.main' : 'grey.100', color: m.role === 'user' ? 'white' : 'text.primary', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography>
              </Paper>
              {m.role === 'user' && <Avatar sx={{ bgcolor: 'info.main', width: 32, height: 32 }}><Person sx={{ fontSize: 18 }} /></Avatar>}
            </Box>
          ))}
          {loading && (
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}><SmartToy sx={{ fontSize: 18 }} /></Avatar>
              <Paper sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 2 }}><Typography variant="body2" color="text.secondary">Thinking...</Typography></Paper>
            </Box>
          )}
          <div ref={endRef} />
        </Box>

        {/* Input */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth placeholder={user ? 'Ask a question...' : 'Log in to chat...'} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              size="small" multiline maxRows={3} disabled={!user}
            />
            <IconButton color="primary" onClick={sendMessage} disabled={!input.trim() || loading || !user}><Send /></IconButton>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            AI responses are for guidance only. Always verify with your course materials.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
