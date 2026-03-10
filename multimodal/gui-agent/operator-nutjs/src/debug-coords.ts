import { screen, mouse, Point, sleep } from '@computer-use/nut-js';

async function diagnose() {
  console.log('--- NutJS Diagnostic V2 ---');

  // 1. Get Screen Dimensions
  const width = await screen.width();
  const height = await screen.height();
  console.log(`Screen Dimensions (Logical): ${width}x${height}`);

  // 2. Test Center
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  console.log(`Moving to Center (${centerX}, ${centerY})...`);
  await mouse.setPosition(new Point(centerX, centerY));
  await sleep(1000); // Wait for OS
  const posCenter = await mouse.getPosition();
  console.log(`Position after move: ${posCenter.x}, ${posCenter.y}`);

  // 3. Test Right Edge (Logical)
  const rightEdge = width - 50;
  console.log(`Moving to Right Edge (${rightEdge}, ${centerY})...`);
  await mouse.setPosition(new Point(rightEdge, centerY));
  await sleep(1000);
  const posEdge = await mouse.getPosition();
  console.log(`Position after move: ${posEdge.x}, ${posEdge.y}`);

  // 4. Test "Scaled Down" Right Edge (if double scaling is happening)
  const scaledDownEdge = Math.floor(rightEdge / 2);
  console.log(`Moving to Scaled Down Edge (${scaledDownEdge}, ${centerY})...`);
  await mouse.setPosition(new Point(scaledDownEdge, centerY));
  await sleep(1000);
  const posScaled = await mouse.getPosition();
  console.log(`Position after move: ${posScaled.x}, ${posScaled.y}`);
}

diagnose().catch(console.error);
