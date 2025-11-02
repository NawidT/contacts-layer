import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Svg, { Circle, Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ReduceMotion
} from 'react-native-reanimated';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { Contact } from '../types/contact';
import { useContacts } from './_layout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GraphNode extends SimulationNodeDatum {
  id: string;
  type: 'contact' | 'hashtag';
  name: string;
  contact?: Contact;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export default function GraphView() {
  const router = useRouter();
  const { contacts } = useContacts();
  const [highlightedHashtags, setHighlightedHashtags] = useState<string[]>([]);
  const [highlightedContacts, setHighlightedContacts] = useState<Contact[]>([]);
  const [hashtagToContacts, setHashtagToContacts] = useState<Map<string, Contact[]>>(new Map());
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [graphBounds, setGraphBounds] = useState({ 
    minX: 0, 
    minY: 0, 
    maxX: SCREEN_WIDTH, 
    maxY: SCREEN_HEIGHT 
  });
  const [firstBuild, setFirstBuild] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Shared values for pan and zoom
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Main background function, constructs graph when contacts are loaded
  useEffect(() => {
    if (contacts.length > 0) {
      buildGraph();
      if (nodes.length > 0 && !firstBuild) {
        let randomNode = nodes[Math.floor(Math.random() * nodes.length)];
        let attempts = 0;
        // Use a while loop to check for available x, y. Limit attempts to avoid infinite loop.
        while ((nodes[attempts].x == null || nodes[attempts].y == null) && attempts < 10) {
          attempts++;
        }
        if (attempts < 10) {
          centerOnNode(nodes[attempts]);
        } else {
          console.log('No available nodes to center on');
        }
      }
    }
  }, []);


  // Secondary background function, creates hashtagToContacts
  useEffect(() => {
    if (contacts.length > 0) {
      const newHashtagToContacts = new Map<string, Contact[]>();
      contacts.forEach((contact) => {
        contact.hashtags?.forEach((hashtag) => {
          newHashtagToContacts.set(hashtag, [...(newHashtagToContacts.get(hashtag) || []), contact]);
        });
      });
      setHashtagToContacts(newHashtagToContacts);
    }
  }, [firstBuild]);

  const buildGraph = async () => {
    setIsLoading(true);
    
    // Use setTimeout to allow loading UI to render
    setTimeout(() => {
      const graphNodes: GraphNode[] = [];
      const graphLinks: GraphLink[] = [];
      const hashtagSet = new Set<string>();

      // Create contact nodes - let D3 calculate positions
      contacts.forEach((contact, index) => {
        graphNodes.push({
          id: `contact-${contact.id}`,
          type: 'contact',
          name: contact.name,
          contact,
          // No initial x, y - let D3 handle it
        });

        if (contact.hashtags) {
          contact.hashtags.forEach((tag) => hashtagSet.add(tag));
        }
        if ((index + 1) % 10 === 0) {
          console.log('We have processed ', index + 1, ' contacts so far');
        }
      });

      // Create hashtag nodes - let D3 calculate positions
      const hashtagArray = Array.from(hashtagSet);
      hashtagArray.forEach((tag) => {
        graphNodes.push({
          id: `hashtag-${tag}`,
          type: 'hashtag',
          name: tag,
          // No initial x, y - let D3 handle it
        });
      });

      // Create links between contacts and hashtags
      contacts.forEach((contact) => {
        if (contact.hashtags) {
          contact.hashtags.forEach((tag) => {
            graphLinks.push({
              source: `contact-${contact.id}`,
              target: `hashtag-${tag}`,
            });
          });
        }
      });

      // Set up D3 force simulation with optimized forces
      const simulation = forceSimulation<GraphNode>(graphNodes)
        .force(
          'link',
          forceLink<GraphNode, GraphLink>(graphLinks)
            .id((d) => d.id)
            .distance(10) // Distance between connected nodes
            .strength(0.7) // Strength of link force (0-1)
        )
        .force('charge', forceManyBody().strength(-10)) // Repulsion between nodes
        .force('center', forceCenter(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2)) // Center the graph
        .force('collision', forceCollide().radius(45)) // Prevent node overlap
        .stop(); // Don't run automatically

      // Run simulation synchronously for fixed iterations
      console.log('Calculating graph layout...');
      const iterations = 300;
      for (let i = 0; i < iterations; ++i) {
        simulation.tick();
      }
      console.log('Graph layout calculated');

      // Calculate bounds of all nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      graphNodes.forEach(node => {
        if (node.x != null && node.y != null) {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x);
          maxY = Math.max(maxY, node.y);
        }
      });
      console.log('Graph bounds: ', minX, minY, maxX, maxY);

      // Add padding
      const padding = 100;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;

      console.log('Graph bounds with padding: ', minX, minY, maxX, maxY);

      // Update graph bounds
      setGraphBounds({ minX, minY, maxX, maxY });

      // Set nodes and links once with final positions
      setNodes([...graphNodes]);
      setLinks(graphLinks);
      setIsLoading(false);
      console.log('Graph loaded successfully');
    }, 50); // Small delay to allow UI to update
    setFirstBuild(true);
  };

  const handleContactPress = (contact: Contact) => {
    console.log('handle contact press for contact: ', contact.name);
    // If contact is already selected, go to detail. Otherwise, highlight contact and their hashtags.
    if (highlightedContacts.some(c => c.id === contact.id)) {
      router.push({
        pathname: '/contact-detail',
        params: { contact: JSON.stringify(contact) },
      });
    } else {
      setHighlightedContacts([contact]);
      setHighlightedHashtags(contact.hashtags || []);
      const contactNode = nodes.find(n => n.id === `contact-${contact.id}`);
      if (contactNode) {
        centerOnNode(contactNode);
      }
    }
  };

  const handleHashtagPress = (hashtag: string) => {
    console.log('handleHashtagPress for hashtag: ', hashtag);
    setHighlightedHashtags([hashtag]);
    setHighlightedContacts(hashtagToContacts.get(hashtag) || []);
    const hashtagNode = nodes.find(n => n.id === `hashtag-${hashtag}`);
    if (hashtagNode) {
      centerOnNode(hashtagNode);
    }
  };

  const handleBackPress = () => {
    setHighlightedContacts([]);
    setHighlightedHashtags([]);
    router.back();
  };

  const centerOnNode = (node: GraphNode) => {
    if (node.x == null || node.y == null) {
      console.log('Node has no x or y');
      return;
    }
    if (node.x != null && node.y != null) {
      console.log('Centering on node: ', node.name);
      // Get current scale
      const currentScale = scale.value;
      
      // Calculate the SVG dimensions
      const svgWidth = graphBounds.maxX - graphBounds.minX;
      const svgHeight = graphBounds.maxY - graphBounds.minY;
      
      // Node position relative to SVG's top-left (accounting for viewBox offset)
      const nodeRelativeX = node.x - graphBounds.minX;
      const nodeRelativeY = node.y - graphBounds.minY;
      
      // Calculate where we want the node to appear on screen
      // For X: center of screen width
      const targetScreenX = SCREEN_WIDTH / 2;
      // For Y: center of the graph container (which excludes header, search bar)
      // The graph container fills the remaining space, so calculate its center
      const headerHeight = Platform.OS === 'ios' ? 100 : 80;
      const searchBarHeight = 60;
      const graphContainerHeight = SCREEN_HEIGHT - headerHeight
      const targetScreenY = graphContainerHeight / 2;
      
      // In React Native, scale transforms around the center of the element
      // SVG center in its own coordinate space
      const svgCenterX = svgWidth / 2;
      const svgCenterY = svgHeight / 2;
      
      // Node position relative to SVG center
      const nodeFromCenterX = nodeRelativeX - svgCenterX;
      const nodeFromCenterY = nodeRelativeY - svgCenterY;
      
      // After scaling around center, node offset from center becomes scaled
      const scaledNodeFromCenterX = nodeFromCenterX * currentScale;
      const scaledNodeFromCenterY = nodeFromCenterY * currentScale;
      
      // Calculate translation needed
      // Target = SVG center position + scaled node offset from center
      // So: SVG center position = Target - scaled node offset
      const svgCenterScreenX = targetScreenX - scaledNodeFromCenterX;
      const svgCenterScreenY = targetScreenY - scaledNodeFromCenterY;
      
      // Translation moves the SVG center from its default position (svgWidth/2, svgHeight/2)
      const newTranslateX = svgCenterScreenX - svgCenterX;
      const newTranslateY = svgCenterScreenY - svgCenterY - searchBarHeight - (Platform.OS === 'ios' ? 70 : 50);
      
      // Animate to the new position with smooth spring animation
      const springConfig = {
        damping: 15, 
        stiffness: 100, 
        mass: 1, 
        overshootClamping: false,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
        reduceMotion: ReduceMotion.System,
      };
      
      translateX.value = withSpring(newTranslateX, springConfig);
      translateY.value = withSpring(newTranslateY, springConfig);
      savedTranslateX.value = newTranslateX;
      savedTranslateY.value = newTranslateY;
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setHighlightedContacts([]);
      setHighlightedHashtags([]);
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    
    // Search for matching contact
    const matchingContact = contacts.find(contact => 
      contact.name.toLowerCase().includes(lowerQuery)
    );
    
    if (matchingContact) {
      const contactNode = nodes.find(n => n.id === `contact-${matchingContact.id}`);
      if (contactNode) {
        setHighlightedContacts([matchingContact]);
        setHighlightedHashtags(matchingContact.hashtags || []);
        centerOnNode(contactNode);
        return;
      }
    }
    
    // Search for matching hashtag
    const matchingHashtag = Array.from(hashtagToContacts.keys()).find(hashtag =>
      hashtag.toLowerCase().includes(lowerQuery)
    );
    
    if (matchingHashtag) {
      const hashtagNode = nodes.find(n => n.id === `hashtag-${matchingHashtag}`);
      if (hashtagNode) {
        setHighlightedHashtags([matchingHashtag]);
        setHighlightedContacts(hashtagToContacts.get(matchingHashtag) || []);
        centerOnNode(hashtagNode);
      }
    }
  };

  // Pinch gesture for zooming (scale only, no translation)
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = Math.max(0.5, Math.min(savedScale.value * event.scale, 3));
      scale.value = newScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  // Pan gesture for moving around
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const resetZoom = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    // center on random node
    centerOnNode(nodes[Math.floor(Math.random() * nodes.length)]);
    setHighlightedContacts([]);
    setHighlightedHashtags([]);
    setSearchQuery('');
  };

  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Graph</Text>
        <TouchableOpacity style={styles.resetButton} onPress={resetZoom}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts or hashtags..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={() => handleSearch('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Graph Canvas */}
      <GestureDetector gesture={composedGesture}>
        <View style={styles.graphContainer}>
          <Animated.View style={animatedStyle}>
            <Svg
              width={graphBounds.maxX - graphBounds.minX}
              height={graphBounds.maxY - graphBounds.minY}
              viewBox={`${graphBounds.minX} ${graphBounds.minY} ${graphBounds.maxX - graphBounds.minX} ${graphBounds.maxY - graphBounds.minY}`}
              onPress={() => {setHighlightedContacts([]); setHighlightedHashtags([]);}}
            >
              <G>
              {/* Draw links */}
              {links.map((link, index) => {
                const sourceNode = nodes.find(
                  (n) => n.id === (typeof link.source === 'string' ? link.source : link.source.id)
                );
                const targetNode = nodes.find(
                  (n) => n.id === (typeof link.target === 'string' ? link.target : link.target.id)
                );

                if (sourceNode && targetNode && sourceNode.x != null && sourceNode.y != null && targetNode.x != null && targetNode.y != null) {
                  return (
                    <Line
                      key={`link-${index}`}
                      x1={sourceNode.x}
                      y1={sourceNode.y}
                      x2={targetNode.x}
                      y2={targetNode.y}
                      stroke="#999"
                      strokeWidth="1"
                      opacity="0.4"
                    />
                  );
                }
                return null;
              })}

              {/* Draw nodes */}
              {nodes.map((node) => {
                // Skip rendering if position is not set
                if (node.x == null || node.y == null) return null;

                if (node.type === 'contact') {
                  const initials = getInitials(node.name);
                  return (
                    <G key={node.id}>
                      <Circle
                        cx={node.x}
                        cy={node.y}
                        r="30"
                        fill="#5AC8FA"
                        stroke={highlightedContacts.some(c => c.id === node.contact?.id) ? "#FF0000" : "#fff"}
                        strokeWidth="5"
                        onPress={() => node.contact && handleContactPress(node.contact)}
                      />
                      <SvgText
                        x={node.x}
                        y={node.y}
                        fontSize="14"
                        fontWeight="bold"
                        fill="#fff"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        onPress={() => node.contact && handleContactPress(node.contact)}
                      >
                        {initials}
                      </SvgText>
                      <SvgText
                        x={node.x}
                        y={node.y + 45}
                        fontSize="10"
                        fill="#333"
                        textAnchor="middle"
                        onPress={() => node.contact && handleContactPress(node.contact)}
                      >
                        {node.name.length > 15 ? node.name.substring(0, 12) + '...' : node.name}
                      </SvgText>
                    </G>
                  );
                } else {
                  // Hashtag node
                  const textWidth = node.name.length * 8;
                  return (
                    <G key={node.id}>
                      <Rect
                        x={node.x - textWidth / 2 - 5}
                        y={node.y - 12}
                        width={textWidth + 10}
                        height="24"
                        fill="#D1D5DB"
                        stroke={highlightedHashtags.includes(node.name) ? "#FF0000" : "#fff"}
                        strokeWidth="1.5"
                        rx="4"
                        onPress={() => handleHashtagPress(node.name)}
                      />
                      <SvgText
                        x={node.x}
                        y={node.y}
                        fontSize="11"
                        fontWeight="600"
                        fill="#fff"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {node.name}
                      </SvgText>
                    </G>
                  );
                }
              })}
              </G>
            </Svg>
          </Animated.View>
          
          {/* Loading indicator */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>
                Calculating layout for {contacts.length} contacts...
              </Text>
            </View>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fafafa',
    zIndex: 1000,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  resetButton: {
    padding: 8,
  },
  resetButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    zIndex: 999,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  clearButton: {
    position: 'absolute',
    right: 28,
    top: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  graphContainer: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(250, 250, 250, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  }
});

