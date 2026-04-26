import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert, Avatar, Box, CircularProgress, Container, Divider,
    IconButton, InputAdornment, List, ListItemAvatar, ListItemButton,
    ListItemText, Menu, MenuItem, Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
    Send, Search, Message as MessageIcon, ArrowBack,
    MoreVert, Edit, Delete, ContentCopy, Check, Close,
} from '@mui/icons-material';


import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

function getWsUrl(conversationId) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const host = isLocal ? '127.0.0.1:8000' : window.location.host;

    return `${wsProtocol}://${host}/ws/messages/${conversationId}/`;
}

function getWsToken() {
    const tokens = JSON.parse(localStorage.getItem('tokens') || '{}');
    return tokens.access || '';
}


function displayUserName(user) {
    if (!user) return 'Unknown user';
    return user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown user';
}

function isSameCalendarDay(a, b) {
    const first = new Date(a);
    const second = new Date(b);

    return (
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    );
}

function formatDateSeparator(value) {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (isSameCalendarDay(date, today)) return 'Today';
    if (isSameCalendarDay(date, yesterday)) return 'Yesterday';

    return date.toLocaleDateString([], {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function canModifyMessage(message, user) {
    if (!message || !user || message.is_deleted) return false;
    if (String(message.sender.id) !== String(user.id)) return false;
    return message.can_modify === true;
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
    const [messageMenuAnchor, setMessageMenuAnchor] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editingBody, setEditingBody] = useState('');
    const [messageActionLoading, setMessageActionLoading] = useState(false);



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

    const conversationReadOnly = activeConversation?.allow_replies === false;

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

    const applyMessageUpdate = (updatedMessage) => {
        setMessages(prev => prev.map(message => (
            message.id === updatedMessage.id ? updatedMessage : message
        )));
        fetchConversations().catch(() => { });
    };

    const openMessageMenu = (event, message) => {
        setMessageMenuAnchor(event.currentTarget);
        setSelectedMessage(message);
    };

    const closeMessageMenu = () => {
        setMessageMenuAnchor(null);
        setSelectedMessage(null);
    };

    const copySelectedMessage = async () => {
        if (!selectedMessage || selectedMessage.is_deleted) return;

        try {
            await navigator.clipboard.writeText(selectedMessage.body);
            closeMessageMenu();
        } catch {
            setError('Could not copy message.');
        }
    };

    const startEditingSelectedMessage = () => {
        if (!selectedMessage) return;

        setEditingMessageId(selectedMessage.id);
        setEditingBody(selectedMessage.body);
        closeMessageMenu();
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditingBody('');
    };

    const saveEditedMessage = async () => {
        const text = editingBody.trim();
        if (!text || !conversationId || !editingMessageId) return;

        setMessageActionLoading(true);
        try {
            const res = await api.patch(`/messages/conversations/${conversationId}/messages/${editingMessageId}/`, {
                body: text,
            });
            applyMessageUpdate(res.data);
            cancelEditing();
        } catch (err) {
            setError(err.response?.data?.error || 'Could not edit message.');
        } finally {
            setMessageActionLoading(false);
        }
    };

    const deleteSelectedMessage = async () => {
        if (!selectedMessage || !conversationId) return;

        setMessageActionLoading(true);
        try {
            const res = await api.delete(`/messages/conversations/${conversationId}/messages/${selectedMessage.id}/`);
            applyMessageUpdate(res.data);
            closeMessageMenu();
        } catch (err) {
            setError(err.response?.data?.error || 'Could not delete message.');
        } finally {
            setMessageActionLoading(false);
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

                    const token = getWsToken();
                    if (!token) {
                        setError('Live chat authentication failed. Please log in again.');
                        socket.close(4001);
                        return;
                    }

                    socket.send(JSON.stringify({ type: 'auth', token }));
                };

                socket.onmessage = (event) => {
                    if (cancelled) return;

                    const data = JSON.parse(event.data);

                    if (data.type === 'auth_ok') {
                        setError('');
                        return;
                    }

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

                    if (data.type === 'message_updated') {
                        applyMessageUpdate(data.message);
                    }

                    if (data.type === 'typing') {
                        setTypingUser(data.is_typing ? data.user_id : null);
                    }
                };

                socket.onerror = () => { };

                socket.onclose = (event) => {
                    if (cancelled) return;

                    if (event.code === 4001) {
                        setError('Live chat authentication failed. Please log in again.');
                        return;
                    }

                    if (event.code === 4003) {
                        setError('You do not have access to this conversation.');
                        return;
                    }

                    if (!opened) {
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
        if (chatLoading) return;

        const frame = window.requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({
                behavior: 'auto',
                block: 'end',
            });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [conversationId, chatLoading, messages.length]);

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
        if (!conversationReadOnly && socketRef.current?.readyState === WebSocket.OPEN) {
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

        if (conversationReadOnly) {
            setError('This StudySpace admin conversation is read-only.');
            return;
        }

        setBody('');
        sendTyping(false);

        if (!conversationReadOnly && socketRef.current?.readyState === WebSocket.OPEN) {
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

            <Paper sx={{
                height: { xs: 'calc(100vh - 150px)', md: '72vh' },
                minHeight: { xs: 520, md: 560 },
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
                overflow: 'hidden',
            }}>
                <Box sx={{
                    borderRight: { md: '1px solid' },
                    borderColor: 'divider',
                    display: { xs: conversationId ? 'none' : 'flex', md: 'flex' },
                    flexDirection: 'column',
                    minHeight: 0,
                }}>
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

                    <List sx={{
                        overflowY: 'auto',
                        flex: 1,
                        minHeight: 0,
                        py: 0,
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        '&::-webkit-scrollbar': {
                            display: 'none',
                        },
                    }}>
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
                                    secondary={
                                        conversation.last_message?.is_deleted
                                            ? 'Message deleted'
                                            : conversation.last_message?.body || 'No messages yet.'
                                    }
                                    secondaryTypographyProps={{
                                        noWrap: true,
                                        fontWeight: conversation.unread_count ? 600 : 400,
                                    }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                </Box>

                <Box sx={{
                    display: { xs: conversationId ? 'flex' : 'none', md: 'flex' },
                    flexDirection: 'column',
                    minWidth: 0,
                    minHeight: 0,
                    overflow: 'hidden',
                }}>
                    {conversationId ? (
                        <>
                            <Box sx={{
                                px: 2,
                                py: 1.5,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                flexShrink: 0,
                            }}>
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

                            <Box sx={{
                                flex: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                p: 2,
                                bgcolor: 'background.default',
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                                '&::-webkit-scrollbar': {
                                    display: 'none',
                                },
                            }}>

                                {chatLoading ? (
                                    <CircularProgress size={24} />
                                ) : (
                                    <Stack spacing={1.25}>
                                        {messages.map((message, index) => {
                                            const mine = String(message.sender.id) === String(user.id);
                                            const isEditing = editingMessageId === message.id;
                                            const showDateSeparator =
                                                index === 0 || !isSameCalendarDay(messages[index - 1].created_at, message.created_at);

                                            return (
                                                <Box key={message.id}>
                                                    {showDateSeparator && (
                                                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                                                            <Typography
                                                                variant="caption"
                                                                sx={{
                                                                    px: 1.5,
                                                                    py: 0.5,
                                                                    borderRadius: 999,
                                                                    bgcolor: 'action.hover',
                                                                    color: 'text.secondary',
                                                                }}
                                                            >
                                                                {formatDateSeparator(message.created_at)}
                                                            </Typography>
                                                        </Box>
                                                    )}

                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            justifyContent: mine ? 'flex-end' : 'flex-start',
                                                            alignItems: 'flex-end',
                                                            gap: 0.5,
                                                        }}
                                                    >
                                                        {!mine && !message.is_deleted && (
                                                            <Tooltip title="Message options">
                                                                <IconButton size="small" onClick={(event) => openMessageMenu(event, message)}>
                                                                    <MoreVert fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}

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
                                                            {isEditing ? (
                                                                <Stack direction="row" spacing={1} alignItems="flex-start">
                                                                    <TextField
                                                                        size="small"
                                                                        multiline
                                                                        maxRows={4}
                                                                        value={editingBody}
                                                                        onChange={(event) => setEditingBody(event.target.value)}
                                                                        autoFocus
                                                                        sx={{
                                                                            minWidth: 220,
                                                                            bgcolor: 'background.paper',
                                                                            borderRadius: 1,
                                                                        }}
                                                                    />
                                                                    <IconButton size="small" onClick={saveEditedMessage} disabled={messageActionLoading || !editingBody.trim()}>
                                                                        <Check fontSize="small" />
                                                                    </IconButton>
                                                                    <IconButton size="small" onClick={cancelEditing}>
                                                                        <Close fontSize="small" />
                                                                    </IconButton>
                                                                </Stack>
                                                            ) : (
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        whiteSpace: 'pre-wrap',
                                                                        overflowWrap: 'anywhere',
                                                                        fontStyle: message.is_deleted ? 'italic' : 'normal',
                                                                        opacity: message.is_deleted ? 0.75 : 1,
                                                                    }}
                                                                >
                                                                    {message.is_deleted ? 'This message was deleted.' : message.body}
                                                                </Typography>
                                                            )}

                                                            <Typography
                                                                variant="caption"
                                                                sx={{
                                                                    display: 'block',
                                                                    mt: 0.5,
                                                                    color: mine ? 'rgba(255,255,255,0.75)' : 'text.secondary',
                                                                }}
                                                            >
                                                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                {message.edited_at && !message.is_deleted ? ' - edited' : ''}
                                                            </Typography>
                                                        </Box>

                                                        {mine && !message.is_deleted && (
                                                            <Tooltip title="Message options">
                                                                <IconButton size="small" onClick={(event) => openMessageMenu(event, message)}>
                                                                    <MoreVert fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </Box>
                                            );
                                        })}

                                        <div ref={bottomRef} />
                                    </Stack>
                                )}
                            </Box>

                            <Box sx={{
                                flexShrink: 0,
                                p: 2,
                                borderTop: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                            }}>
                                {conversationReadOnly && (
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        This StudySpace admin conversation is read-only.
                                    </Typography>
                                )}

                                <TextField
                                    fullWidth
                                    multiline
                                    maxRows={4}
                                    placeholder={conversationReadOnly ? 'Read-only conversation' : 'Write a message'}
                                    value={body}
                                    onChange={handleBodyChange}
                                    onKeyDown={handleKeyDown}
                                    disabled={conversationReadOnly}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton color="primary" onClick={sendMessage} disabled={conversationReadOnly || !body.trim()}>
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
            <Menu
                anchorEl={messageMenuAnchor}
                open={Boolean(messageMenuAnchor)}
                onClose={closeMessageMenu}
            >
                <MenuItem onClick={copySelectedMessage} disabled={!selectedMessage || selectedMessage.is_deleted}>
                    <ContentCopy sx={{ mr: 1, fontSize: 18 }} />
                    Copy
                </MenuItem>

                {selectedMessage && String(selectedMessage.sender.id) === String(user.id) && (
                    <MenuItem
                        onClick={startEditingSelectedMessage}
                        disabled={!canModifyMessage(selectedMessage, user) || messageActionLoading}
                    >
                        <Edit sx={{ mr: 1, fontSize: 18 }} />
                        Edit
                    </MenuItem>
                )}

                {selectedMessage && String(selectedMessage.sender.id) === String(user.id) && (
                    <MenuItem
                        onClick={deleteSelectedMessage}
                        disabled={!canModifyMessage(selectedMessage, user) || messageActionLoading}
                        sx={{ color: 'error.main' }}
                    >
                        <Delete sx={{ mr: 1, fontSize: 18 }} />
                        Delete
                    </MenuItem>
                )}
            </Menu>
        </Container>
    );
}
