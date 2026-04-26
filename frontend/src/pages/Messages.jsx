import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert, Avatar, Box, Button, CircularProgress, Container, Divider,
    IconButton, InputAdornment, List, ListItemAvatar, ListItemButton,
    ListItemText, Paper, Stack, TextField, Typography,
} from '@mui/material';
import {
    Send, Search, Message as MessageIcon, ArrowBack,
} from '@mui/icons-material';

import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

function getWsUrl(conversationId) {
    const tokens = JSON.parse(localStorage.getItem('tokens') || '{}');
    const token = encodeURIComponent(tokens.access || '');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const host = isLocal ? '127.0.0.1:8000' : window.location.host;

    return `${wsProtocol}://${host}/ws/messages/${conversationId}/?token=${token}`;
}



function displayUserName(user) {
    if (!user) return 'Unknown user';
    return user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown user';
}

export default function Messages() {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [error, setError] = useState('');
    const [typingUser, setTypingUser] = useState(null);
    const [draftConversation, setDraftConversation] = useState(null);
    const [selectedConversation, setSelectedConversation] = useState(null);


    const socketRef = useRef(null);
    const bottomRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    const activeConversation = useMemo(
        () =>
            conversations.find(c => c.id === conversationId) ||
            (draftConversation?.id === conversationId ? draftConversation : null) ||
            (selectedConversation?.id === conversationId ? selectedConversation : null),
        [conversations, conversationId, draftConversation, selectedConversation]
    );


    const fetchConversations = async () => {
        const res = await api.get('/messages/conversations/');
        setConversations(res.data.results || res.data || []);
    };

    const fetchMessages = async (id) => {
        setChatLoading(true);
        try {
            const conversationRes = await api.get(`/messages/conversations/${id}/`);
            setSelectedConversation(conversationRes.data);

            const res = await api.get(`/messages/conversations/${id}/messages/`);
            setMessages(res.data.results || res.data || []);

            await api.post(`/messages/conversations/${id}/read/`);
            await fetchConversations();
        } finally {
            setChatLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchConversations()
            .catch(() => setError('Could not load conversations.'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!loading && !conversationId && conversations.length > 0) {
            navigate(`/messages/${conversations[0].id}`, { replace: true });
        }
    }, [loading, conversationId, conversations, navigate]);


    useEffect(() => {
        if (!conversationId) {
            setMessages([]);
            setSelectedConversation(null);
            return;
        }

        let cancelled = false;
        let opened = false;
        let socket = null;

        const connect = async () => {
            try {
                await fetchMessages(conversationId);
                if (cancelled) return;

                socket = new WebSocket(getWsUrl(conversationId));
                socketRef.current = socket;

                socket.onopen = () => {
                    if (cancelled) return;
                    opened = true;
                    setError('');
                };

                socket.onmessage = (event) => {
                    if (cancelled) return;

                    const data = JSON.parse(event.data);

                    if (data.type === 'error') {
                        setError(data.message || 'Live message delivery failed.');
                        return;
                    }

                    if (data.type === 'message') {
                        setMessages(prev => {
                            if (prev.some(m => m.id === data.message.id)) return prev;
                            return [...prev, data.message];
                        });
                        fetchConversations().catch(() => { });
                    }

                    if (data.type === 'typing') {
                        setTypingUser(data.is_typing ? data.user_id : null);
                    }
                };

                socket.onerror = () => { };

                socket.onclose = (event) => {
                    if (!cancelled && !opened) {
                        setError(`Live chat connection failed. WebSocket closed with code ${event.code}.`);
                    }
                };
            } catch {
                if (!cancelled) {
                    setError('Could not load messages.');
                }
            }
        };

        connect();

        return () => {
            cancelled = true;

            if (socket) {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onerror = null;
                socket.onclose = null;

                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close();
                }
            }

            if (socketRef.current === socket) {
                socketRef.current = null;
            }

            setTypingUser(null);
        };
    }, [conversationId]);


    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    useEffect(() => {
        if (!search.trim()) {
            setSearchResults([]);
            return;
        }

        const handle = setTimeout(async () => {
            try {
                const res = await api.get(`/messages/users/?q=${encodeURIComponent(search.trim())}`);
                setSearchResults(res.data.results || res.data || []);
            } catch {
                setSearchResults([]);
            }
        }, 250);

        return () => clearTimeout(handle);
    }, [search]);

    const startConversation = async (selectedUser) => {
        const res = await api.post('/messages/conversations/start/', {
            user_id: selectedUser.id,
        });

        setDraftConversation(res.data);
        await fetchConversations();
        setSearch('');
        setSearchResults([]);
        navigate(`/messages/${res.data.id}`);
    };

    const sendTyping = (isTyping) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }));
        }
    };

    const handleBodyChange = (e) => {
        setBody(e.target.value);
        sendTyping(true);

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => sendTyping(false), 900);
    };

    const sendMessage = async () => {
        const text = body.trim();
        if (!text || !conversationId) return;

        setBody('');
        sendTyping(false);

        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'message', body: text }));
            return;
        }

        const res = await api.post(`/messages/conversations/${conversationId}/messages/`, {
            body: text,
        });
        setMessages(prev => [...prev, res.data]);
        await fetchConversations();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <CircularProgress />
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <Typography variant="h3" sx={{ mb: 2 }}>
                Messages
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            <Paper sx={{ height: '72vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, overflow: 'hidden' }}>
                <Box sx={{ borderRight: { md: '1px solid' }, borderColor: 'divider', display: { xs: conversationId ? 'none' : 'block', md: 'block' } }}>
                    <Box sx={{ p: 2 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search students or tutors"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>

                    {searchResults.length > 0 && (
                        <>
                            <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
                                Start a conversation
                            </Typography>
                            <List dense>
                                {searchResults.map((result) => (
                                    <ListItemButton key={result.id} onClick={() => startConversation(result)}>
                                        <ListItemAvatar>
                                            <Avatar src={result.avatar_url || undefined}>{displayUserName(result)[0]}</Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={displayUserName(result)}
                                            secondary={result.role}
                                        />
                                    </ListItemButton>
                                ))}
                            </List>
                            <Divider />
                        </>
                    )}

                    <List sx={{ overflow: 'auto', height: searchResults.length ? 'calc(72vh - 210px)' : 'calc(72vh - 73px)' }}>
                        {conversations.length === 0 ? (
                            <Box sx={{ p: 3, textAlign: 'center' }}>
                                <MessageIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                    Search for a student or tutor to start chatting.
                                </Typography>
                            </Box>
                        ) : conversations.map((conversation) => (
                            <ListItemButton
                                key={conversation.id}
                                selected={conversation.id === conversationId}
                                onClick={() => navigate(`/messages/${conversation.id}`)}
                                sx={{ alignItems: 'flex-start' }}
                            >
                                <ListItemAvatar>
                                    <Avatar src={conversation.other_user?.avatar_url || undefined}>
                                        {displayUserName(conversation.other_user)[0]}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                                            <Typography variant="body2" fontWeight={conversation.unread_count ? 700 : 500}>
                                                {displayUserName(conversation.other_user)}
                                            </Typography>
                                            {conversation.unread_count > 0 && (
                                                <Box sx={{
                                                    minWidth: 20,
                                                    height: 20,
                                                    px: 0.75,
                                                    borderRadius: 10,
                                                    bgcolor: 'primary.main',
                                                    color: 'white',
                                                    fontSize: 12,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    {conversation.unread_count}
                                                </Box>
                                            )}
                                        </Stack>
                                    }
                                    secondary={conversation.last_message?.body || 'No messages yet.'}
                                    secondaryTypographyProps={{
                                        noWrap: true,
                                        fontWeight: conversation.unread_count ? 600 : 400,
                                    }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                </Box>

                <Box sx={{ display: { xs: conversationId ? 'flex' : 'none', md: 'flex' }, flexDirection: 'column', minWidth: 0 }}>
                    {conversationId ? (
                        <>
                            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <IconButton sx={{ display: { md: 'none' } }} onClick={() => navigate('/messages')}>
                                    <ArrowBack />
                                </IconButton>
                                <Avatar src={activeConversation?.other_user?.avatar_url || undefined}>
                                    {displayUserName(activeConversation?.other_user)[0]}
                                </Avatar>
                                <Box>
                                    <Typography variant="h5">{displayUserName(activeConversation?.other_user)}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {typingUser ? 'Typing...' : activeConversation?.other_user?.role || ''}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: 'background.default' }}>
                                {chatLoading ? (
                                    <CircularProgress size={24} />
                                ) : (
                                    <Stack spacing={1.25}>
                                        {messages.map((message) => {
                                            const mine = message.sender.id === user.id;
                                            return (
                                                <Box
                                                    key={message.id}
                                                    sx={{
                                                        display: 'flex',
                                                        justifyContent: mine ? 'flex-end' : 'flex-start',
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            maxWidth: '72%',
                                                            px: 1.5,
                                                            py: 1,
                                                            borderRadius: 2,
                                                            bgcolor: mine ? 'primary.main' : 'white',
                                                            color: mine ? 'primary.contrastText' : 'text.primary',
                                                            border: mine ? 'none' : '1px solid',
                                                            borderColor: 'divider',
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                                            {message.body}
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                display: 'block',
                                                                mt: 0.5,
                                                                color: mine ? 'rgba(255,255,255,0.75)' : 'text.secondary',
                                                            }}
                                                        >
                                                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                        <div ref={bottomRef} />
                                    </Stack>
                                )}
                            </Box>

                            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    maxRows={4}
                                    placeholder="Write a message"
                                    value={body}
                                    onChange={handleBodyChange}
                                    onKeyDown={handleKeyDown}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton color="primary" onClick={sendMessage} disabled={!body.trim()}>
                                                    <Send />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Box>
                        </>
                    ) : (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 3 }}>
                            <Box>
                                <MessageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                <Typography variant="h4" sx={{ mb: 1 }}>Select a conversation</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Choose a chat or search for a student or tutor to start a new one.
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Paper>
        </Container>
    );
}
